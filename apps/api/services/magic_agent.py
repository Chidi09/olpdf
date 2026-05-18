"""MagicAgent — multi-turn ReAct loop for PDF processing with Gemini."""

import json
import logging
import uuid
from typing import Any, AsyncIterator, Dict, List, Optional

import google.generativeai as genai
from google.generativeai import protos

from ..config import get_settings
from .magic_agent_tools import (
    ALL_EXECUTORS,
    ALL_TOOL_DEFINITIONS,
    REACT_SYSTEM_PROMPT,
    download_pdf_bytes,
    upload_result_bytes,
)

logger = logging.getLogger(__name__)

_MAX_TURNS = 20


class MagicAgent:
    """Multi-turn ReAct agent that inspects a PDF, plans operations, and
    executes them via Gemini function calling with full result observation."""

    def __init__(self, model: str = "gemini-2.0-flash"):
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        self._model = genai.GenerativeModel(model)
        self._pdf_bytes: Optional[bytes] = None
        self._doc_id: Optional[str] = None
        self._analysis_results: List[dict] = []

    async def run(
        self, doc_id: str, instruction: str
    ) -> AsyncIterator[dict]:
        """Run the ReAct loop. Yields event dicts:
        - {"type":"thought","content":"..."}
        - {"type":"action","tool":"...","args":{...}}
        - {"type":"observation","content":"..."}
        - {"type":"complete","url":"...","summary":"..."}
        - {"type":"error","message":"..."}
        """
        self._doc_id = doc_id
        self._analysis_results = []

        try:
            self._pdf_bytes = download_pdf_bytes(doc_id)
        except ValueError as e:
            yield {"type": "error", "message": str(e)}
            return

        chat = self._model.start_chat()

        combined_prompt = f"{REACT_SYSTEM_PROMPT}\n\nUser request: {instruction}"
        response = chat.send_message(
            combined_prompt,
            tools=ALL_TOOL_DEFINITIONS,
            tool_config={"function_calling_config": {"mode": "AUTO"}},
        )

        turn = 0
        while turn < _MAX_TURNS:
            turn += 1
            candidate = response.candidates[0]
            content = candidate.content

            fcs = [p.function_call for p in content.parts if p.function_call]

            if not fcs:
                text = "".join(p.text for p in content.parts if p.text)
                if text:
                    yield {"type": "thought", "content": text}
                url = self._upload_result()
                analysis = self._analysis_results if self._analysis_results else None
                yield {
                    "type": "complete",
                    "url": url,
                    "summary": text or "All operations completed.",
                    "analysis": analysis,
                }
                return

            # Execute all function calls from this turn
            function_responses = []
            for fc in fcs:
                tool_name = fc.name
                tool_args = dict(fc.args)

                yield {"type": "action", "tool": tool_name, "args": tool_args}

                executor = ALL_EXECUTORS.get(tool_name)
                if not executor:
                    error_msg = f"Unknown tool: {tool_name}"
                    yield {"type": "observation", "content": error_msg}
                    function_responses.append(
                        protos.Part(
                            function_response=protos.FunctionResponse(
                                name=tool_name,
                                response={"error": error_msg},
                            )
                        )
                    )
                    continue

                try:
                    result = await executor(self._pdf_bytes, tool_args)
                    if isinstance(result, bytes):
                        self._pdf_bytes = result
                        observation_text = f"Completed {tool_name}."
                    else:
                        observation_text = str(result)
                    yield {"type": "observation", "content": observation_text}
                    function_responses.append(
                        protos.Part(
                            function_response=protos.FunctionResponse(
                                name=tool_name,
                                response={"result": observation_text},
                            )
                        )
                    )
                except ValueError as e:
                    err_msg = str(e)
                    if err_msg.startswith("__analysis__:"):
                        analysis_json = json.loads(err_msg[len("__analysis__:"):])
                        self._analysis_results.append(analysis_json)
                        yield {"type": "observation", "content": json.dumps(analysis_json)}
                        function_responses.append(
                            protos.Part(
                                function_response=protos.FunctionResponse(
                                    name=tool_name,
                                    response={"analysis": analysis_json},
                                )
                            )
                        )
                    else:
                        yield {"type": "observation", "content": f"Error: {err_msg}"}
                        function_responses.append(
                            protos.Part(
                                function_response=protos.FunctionResponse(
                                    name=tool_name,
                                    response={"error": err_msg},
                                )
                            )
                        )
                except Exception as e:
                    logger.exception(f"Tool {tool_name} failed")
                    yield {"type": "observation", "content": f"Error: {e}"}
                    function_responses.append(
                        protos.Part(
                            function_response=protos.FunctionResponse(
                                name=tool_name,
                                response={"error": str(e)},
                            )
                        )
                    )

            # Send all function responses back in one message
            response = chat.send_message(
                function_responses,
                tools=ALL_TOOL_DEFINITIONS,
            )

        # Max turns reached
        url = self._upload_result()
        yield {
            "type": "complete",
            "url": url,
            "summary": "Reached maximum reasoning turns. Partial results saved.",
            "analysis": self._analysis_results if self._analysis_results else None,
        }

    def _upload_result(self) -> str:
        if self._pdf_bytes is None:
            return ""
        filename = f"{self._doc_id}_{uuid.uuid4().hex[:12]}.pdf"
        return upload_result_bytes(self._pdf_bytes, filename)
