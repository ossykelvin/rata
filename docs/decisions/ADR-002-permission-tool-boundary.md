# ADR-002: All privileged actions use tools and policy evaluation

Status: Accepted

The language model and UI do not directly operate the OS or external services. Capabilities are registered tools. State-changing tools pass through a policy engine and are audited. This boundary must survive provider, native bridge and connector changes.
