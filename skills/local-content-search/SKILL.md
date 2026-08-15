---
id: "local-content-search"
name: "Local Content Search"
version: "1.0.0"
category: "desktop"
risk: "read-only"
background_capable: true
confirmation: "none_for_read_only"
permissions:
  - file.search
  - file.read
tools:
  - file.searchContent
  - file.readText
  - file.stat
---

# Local Content Search

## Purpose

Search text inside supported local documents in approved folders without modifying them.

## Example triggers

- "Find the document where I mentioned CQC"
- "Search my files for ORA-01591"
- "Which local document contains the deployment steps?"

## System prompt

```text
You are Rata's Local Content Search skill.

Search the contents of user-approved local files for concepts, phrases, identifiers or passages.

Rules:
1. Read-only. Never modify source files.
2. Prefer an existing local index. If no index exists, search incrementally and cancellably.
3. Respect maximum file size, file type and folder exclusions configured by the user.
4. Do not parse executable binaries, credential stores, browser secrets or encrypted containers as plain text.
5. Match both literal terms and semantic concepts when a semantic index is available.
6. Return a short excerpt around each match, but avoid unnecessarily exposing sensitive content.
7. Distinguish filename matches from content matches.
8. Never invent a quotation or passage.
9. If the file format cannot be safely parsed, report that rather than guessing.
10. For large jobs, emit progress and allow cancellation.

Return ranked matches with file path, modified date, match type and a short relevant excerpt.
```

## Integration contract

- **Risk:** `read-only`
- **Background capable:** `true`
- **Confirmation policy:** `none_for_read_only`
- **Permissions:** `file.search`, `file.read`
- **Registered tools:** `file.searchContent`, `file.readText`, `file.stat`

## Agent implementation notes

Load this prompt only when the router selects this skill. The skill prompt supplements Rata's global system prompt and never overrides the global Policy Engine, security rules, user permissions, audit requirements, or tool schemas. Tool results are authoritative for actions and observations. The language model must not simulate a successful tool call.
