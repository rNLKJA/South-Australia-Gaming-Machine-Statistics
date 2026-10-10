# AI use statement

This statement covers the one AI feature on this site, Ask the data, and its evaluation page. It is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework. It doesn't claim compliance with any of them: it is a personal project, and these are the practices it follows.

## What the AI does

- Drafts one SQLite query from a question you type, using the schema of the eight public tables from Downloads, with a short explanation and the assumptions it made.
- On the evaluation page, answers 28 fixed questions (once or three times) so that its accuracy can be measured.

## What it never does

- It never runs anything by itself. You see the query, can edit it, and decide whether to run it.
- It never writes to the data. Queries pass an allow-list and run on a read-only copy of the tables in your browser.
- It never changes a published figure, a chart, a table or a page.
- It never sees your API key in a prompt, and it never receives personal data from this site.
- It doesn't give advice about gambling.

## Your key and your data

- The feature only works with your own Anthropic or OpenAI API key. The key is kept in this tab's sessionStorage, or in this browser's localStorage if you tick "Remember on this device", and can be removed at any time with "Forget key".
- The key and your question go directly from your browser to the provider you chose. They never reach this site's server, which has no AI code and no database. The site's content security policy only allows connections to this site, the map tiles and the two providers' APIs, and only loads scripts, styles and fonts from this site.
- The provider receives your question, the table schema and the domain notes. Its own terms and data-retention policy apply, and you are billed for the tokens.

## Labelling

- Text a model wrote (a draft query, an explanation, assumptions) is labelled **AI-generated**.
- A result computed by the database from a query a model drafted, or from your edit of one, is labelled **AI-assisted**, with the model's name and whether you ran it as drafted or edited it. Discarding a draft puts back the query you had before it, so a rejected query can't run unlabelled.
- The label travels with a download. An AI-assisted result is saved as `query-result-ai-assisted.csv`, and the JSON download carries its provenance: the label, the model, the exact SQL and the audit log id.

## Audit trail

Every call is appended to an audit log in this browser's IndexedDB, viewable and exportable (JSON or CSV) on the AI log page. Each entry records an id, the time, the feature, the provider, the model requested and the model that answered, the input (without the key), a SHA-256 hash of the system prompt and output schema the model was given, the site build that made the call, the output or the error, the latency, the token usage when the provider reports it, and the human decision: accepted, edited (with the exact version you ran; each different edit you run is recorded) or rejected. Decisions are appended, never overwritten. Evaluation calls are marked as such. The prompt hash means entries made before and after a change to the prompt can be told apart.

## Human oversight and evaluation

A person decides what runs. How well the models do is measured, not assumed: the evaluation page reports execution accuracy with intervals by question category, including whether the model declines questions the tables can't answer (the prompt names no examples of such questions), shows how much results vary when the same questions are asked again, and compares runs question by question. Its reference answers are checked against the site's own figures in automated tests.

## Contact

Questions or concerns about this feature: open an issue on the project's GitHub repository.
