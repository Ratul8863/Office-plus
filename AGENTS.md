<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Learned User Preferences
- Prefer Bangla/Banglish responses when the user writes in Bangla.

## Learned Workspace Facts
- The repo includes a hardware-backed MQTT integration under `IUT-Hackathon-IoT-Circuit-` using the `smartoffice/drawing/` topic family.
- The `drawing` room is wired to the hardware path, with main app control flowing `frontend -> backend API -> backend MQTT -> hardware -> backend -> Socket.IO -> frontend`.
- The frontend consumes live office updates over Socket.IO, while the Discord bot reads backend state through HTTP/API flows rather than subscribing to Socket.IO directly.
