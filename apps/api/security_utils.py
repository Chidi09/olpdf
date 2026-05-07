from .core.security import (  # noqa: F401
    sanitize_text,
    sanitize_html,
    sanitize_dict,
    sanitize_document_model,
    generate_api_key,
    hash_api_key,
    get_key_prefix,
)

# backward-compat alias
sanitize_string = sanitize_text
