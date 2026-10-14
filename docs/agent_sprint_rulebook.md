# Module 2: Agent Sprint

**Module Specification & Participant Guide**
The Engineer's Code 2026 — Directorate of AI, NED University

| | |
|---|---|
| **Team composition** | 3 to 4 registered members |
| **Development window** | 5 continuous hours (single block) |
| **Submission medium** | Source code via email (Day 1) |
| **Evaluation format** | 5–10 min presentation & reasoning demo |

**Primary Objective:** Build a fully autonomous AI agent capable of executing an end-to-end multi-step task chain without human intervention. The system must formulate plans, call external tools or APIs, handle intermediate state failures, and dynamically choose subsequent actions based on prior execution outputs.

## Universal Event Regulations

### Standard Operating Principles

- Participation is restricted exclusively to officially registered team members. Direct collaboration with external contacts or remote assistants is strictly forbidden.
- All development must occur on-site during the uninterrupted 5-hour session; pre-configured solutions or post-deadline submissions will not be scored.
- Teams are responsible for their own development machines, API keys, and environment dependencies. Standard AI developer tooling (Claude, OpenAI, Gemini, Cursor) is allowed.
- Assessments are conducted orally. Panels will evaluate autonomous decision boundaries, reasoning logs, error recovery mechanisms, and live execution rather than presentation slide decks.

## Module Regulations & Technical Boundaries

### Permitted Technologies & Workflows

- Specialized agentic architectures and frameworks (LangChain, LlamaIndex, CrewAI, AutoGen, or custom Python execution loops).
- Any external REST APIs, custom tool integrations, web scraping modules, or computational utilities pertinent to the revealed challenge.
- Commercial and open-source LLM reasoning endpoints with function calling support.
- AI-assisted programming environments and interactive REPL workflows.

### Strictly Prohibited Practices

- Hardcoding deterministic logic paths or simulating autonomous decisions through fixed scripts.
- Manual operator intervention or intermediate payload copying between execution stages.
- Interacting with real individuals, external personal credentials, or non-designated production services.
- Inter-team repository leakage, code exchange, or altering commits following final submission.

### System Requirements & Deliverables

Deliverables require clean source code, dependency specifications (`requirements.txt`), execution instructions, and structured decision logs. The solution must run end-to-end autonomously from an unseen prompt or input dataset provided during assessment.

## Recommended Technical Pipeline

1. **Task Decomposition:** Map the revealed problem statement from initial input to terminal deliverable, isolating mandatory subgoals and dependency order.
2. **Autonomy Boundary Definition:** Clearly delineate where autonomous LLM decision-making is necessary versus deterministic procedural operations.
3. **Framework & Tool Selection:** Select the agent framework, reasoning model, and tool interfaces best suited to the operational task chain.
4. **Modular Tool Unit Testing:** Implement and validate each agent tool, API wrapper, and sub-action in isolation before chaining.
5. **End-to-End Orchestration:** Connect individual actions into an autonomous reasoning loop and execute uninterrupted test runs from start to finish.
6. **Fault Tolerance & Self-Healing:** Design fallback pathways for empty outputs, malformed tool arguments, schema validation errors, and timeout conditions.
7. **Structured Decision Logging:** Incorporate detailed operational logging to expose intermediate thoughts, actions, observation states, and branch rationales.
8. **Unseen Input Validation:** Stress test the autonomous pipeline against unannounced edge cases, ambiguous inputs, and noisy parameters.
9. **Packaging & Code Submission:** Package the project repository with clear setup documentation, dependency manifests, and submit via email before cutoff.
10. **Oral Defense Preparation:** Structure oral explanations demonstrating step-by-step reasoning logic, design trade-offs, and behavioral safeguards.

## Participant Guidance & FAQ

**Q: What strictly qualifies as an autonomous agent in this module?**
A system that independently navigates a multi-step objective, dynamically determining its next tool invocation or operational step based on the outcome of previous observations without human prompting.

**Q: Is a graphical user interface (GUI) necessary for this challenge?**
Only if explicitly specified in the problem release statement. In all standard scenarios, comprehensive terminal output or structured execution logs demonstrating decision chains are completely sufficient.

**Q: How are tool invocation failures or runtime exceptions penalized?**
Exceptions are normal in complex agent workflows. Evaluators assess whether your agent detects the failure, implements programmatic recovery or alternative routing, and self-corrects constructively.

**Q: Will evaluation panels test the system on unseen live prompts?**
Yes. Teams will be asked to run their agent live on novel inputs and explain the model's intermediate tool-selection reasoning as it executes.

**Q: The session runs for 5 continuous hours without formal breaks. How should teams manage time?**
The session clock operates continuously without pauses. Teams are expected to rotate short breaks internally while sustaining development progress.

**Q: Can architectural plans or prompt chains be modified midway through the sprint?**
Yes, provided the final system satisfies the autonomous execution criteria and the team can clearly articulate the technical justification for the design pivot.

---

*NED University of Engineering & Technology • SENTEC 2026 Directorate of AI — The Engineer's Code 2026, Official Participant Guidelines*
