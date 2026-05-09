# VibeMap

> *Drop your idea. Get the map.*

VibeMap is an AI powered architecture visualizer that turns plain-language descriptions into interactive diagrams, real-world analogies, and clean commented code  so you actually understand what you're building, not just copy it.

---

## Inspiration

We used our own necessity as inspiration. As students who learned to program in the AI era, using AI as a tool feels completely normal but sometimes we don't even understand what is going on under the hood. So we decided to keep things simple and help people like us really understand what happens in their own code. ChatGPT, Claude, and Gemini can give you code, but we want to give you a tool that maps what you are building so you can actually follow it.

---

## What it does

VibeMap takes a description of what you want to build and gives you three things simultaneously:

- **Architecture Diagram**  a Mermaid flowchart showing how your components connect
- **Real-World Analogy**  a comparison with everyday activities so you can actually comprehend what is being explained
- **Commented Code**  clean code organized by file, linked to the diagram

Instead of reading code and imagining the structure, you see the structure first.

---

## How we built it

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| AI | Google Gemini API |
| Diagrams | Mermaid.js |

We used React and Tailwind for the frontend, Mermaid.js for rendering the architecture diagrams, and the Gemini API as the backbone. We engineered a structured prompt that returns the Mermaid diagram syntax, the metaphor explanation, and the file list with code — making the output predictable and renderable without post-processing.

---

## Challenges we ran into

The hardest part wasn't the code it was the idea itself. With limited time, we needed something genuinely useful, visually impressive, and actually buildable in one day. Once we locked in the concept, we had to fight with prompt engineering to get the AI to return exactly the structure we needed. We also ran into issues with HTML and file size limits when uploading content, and spent real time on the design of the web, because we wanted it to look attractive and polished, not just functional.

---

## Accomplishments that we're proud of

- Built a working full-stack AI product from scratch in 8 hours
- The three-output system (diagram + analogy + code) actually works and makes architecture genuinely understandable
- Mermaid diagrams render correctly from raw AI output with no manual editing
- The app looks and feels like a real product, not a hackathon prototype

---

## What we learned

We learned a lot about working with external APIs and structuring AI prompts to get reliable, parseable output. But more than the technical side this was the first hackathon for every single member of our team. We learned how to work under pressure, make decisions fast, split work efficiently, and ship something real together in a few hours. That experience alone was worth it.

---

## What's next for VibeMap

- **GitHub integration**  analyze any public repo directly from a URL
- **Exportable blueprints**  download diagrams as PNG or PDF
- **Diff mode** compare two versions of a project and visualize what changed
- **Team collaboration**  share your VibeMap with teammates via a link

---

## Team

Built in 8 hours by a 3-person team — first hackathon for all of us.
