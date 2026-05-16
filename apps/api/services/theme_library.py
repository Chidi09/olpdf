THEMES: dict[str, str] = {
    "corporate": """/* Corporate — navy headings, Georgia serif, tight margins */
* {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 11pt;
  color: #333333;
  line-height: 1.4;
  margin-bottom: 6pt;
}
h1, .heading1 {
  font-family: Georgia, serif;
  font-size: 22pt;
  color: #1B2A4A;
  font-weight: bold;
  margin-top: 18pt;
  margin-bottom: 8pt;
}
h2, .heading2 {
  font-family: Georgia, serif;
  font-size: 16pt;
  color: #1B2A4A;
  font-weight: bold;
  margin-top: 14pt;
  margin-bottom: 6pt;
}
h3, .heading3 {
  font-family: Georgia, serif;
  font-size: 13pt;
  color: #1B2A4A;
  font-weight: bold;
  margin-top: 10pt;
  margin-bottom: 4pt;
}
.callout {
  background-color: #F0F4F8;
  border-left: 4px solid #1B2A4A;
  padding: 10pt 12pt;
  font-size: 10.5pt;
  color: #333333;
}
table, .table {
  font-family: Georgia, serif;
  font-size: 10pt;
  color: #333333;
}
""",
    "academic": """/* Academic — Times New Roman, 1.6 line height, indented paragraphs */
* {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  color: #000000;
  line-height: 1.6;
  text-align: justify;
}
h1, .heading1 {
  font-family: "Times New Roman", Times, serif;
  font-size: 18pt;
  color: #000000;
  font-weight: bold;
  text-align: center;
  margin-top: 24pt;
  margin-bottom: 12pt;
}
h2, .heading2 {
  font-family: "Times New Roman", Times, serif;
  font-size: 14pt;
  color: #000000;
  font-weight: bold;
  margin-top: 18pt;
  margin-bottom: 6pt;
}
h3, .heading3 {
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  color: #000000;
  font-weight: bold;
  font-style: italic;
  margin-top: 12pt;
  margin-bottom: 4pt;
}
p, .paragraph {
  text-indent: 36pt;
  margin-bottom: 0pt;
}
.callout {
  background-color: #F9F9F9;
  border-left: 2pt solid #000000;
  padding: 8pt 12pt;
  font-size: 11pt;
  font-style: italic;
}
""",
    "resume": """/* Resume — tight line height, bold h1 for name, h2 for section titles */
* {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  color: #222222;
  line-height: 1.2;
  margin-bottom: 2pt;
}
h1, .heading1 {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 26pt;
  color: #1a1a1a;
  font-weight: bold;
  text-align: center;
  margin-bottom: 4pt;
  letter-spacing: 1pt;
}
h2, .heading2 {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 12pt;
  color: #1a1a1a;
  font-weight: bold;
  text-transform: uppercase;
  margin-top: 10pt;
  margin-bottom: 4pt;
  letter-spacing: 0.5pt;
}
h3, .heading3 {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  color: #333333;
  font-weight: bold;
  margin-top: 6pt;
  margin-bottom: 2pt;
}
ul, ol, .list {
  margin-top: 2pt;
  margin-bottom: 2pt;
  padding: 0 0 0 18pt;
}
""",
    "minimal": """/* Minimal — system-ui sans, maximum whitespace, no decoration */
* {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11pt;
  color: #444444;
  line-height: 1.7;
  margin-bottom: 8pt;
}
h1, .heading1 {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 24pt;
  color: #111111;
  font-weight: 300;
  margin-top: 32pt;
  margin-bottom: 12pt;
}
h2, .heading2 {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 18pt;
  color: #222222;
  font-weight: 400;
  margin-top: 24pt;
  margin-bottom: 8pt;
}
h3, .heading3 {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14pt;
  color: #333333;
  font-weight: 500;
  margin-top: 16pt;
  margin-bottom: 4pt;
}
.callout {
  background-color: #F5F5F5;
  padding: 12pt 16pt;
  font-size: 10.5pt;
  color: #555555;
}
""",
    "bold": """/* Bold — 36pt+ headings, vibrant accent, colourful callouts */
* {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 11pt;
  color: #1a1a2e;
  line-height: 1.5;
}
h1, .heading1 {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 36pt;
  color: #16213E;
  font-weight: 900;
  margin-top: 24pt;
  margin-bottom: 6pt;
  letter-spacing: -0.5pt;
}
h2, .heading2 {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 22pt;
  color: #0F3460;
  font-weight: 800;
  margin-top: 18pt;
  margin-bottom: 4pt;
}
h3, .heading3 {
  font-family: Inter, "Segoe UI", system-ui, sans-serif;
  font-size: 16pt;
  color: #0F3460;
  font-weight: 700;
  margin-top: 12pt;
  margin-bottom: 4pt;
}
.callout {
  background-color: #FFF4E0;
  border-left: 6px solid #E94560;
  padding: 12pt 16pt;
  font-size: 11pt;
  color: #1a1a2e;
  font-weight: 500;
}
""",
}
