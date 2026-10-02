# Lessons learned

- On this Windows workspace, run Vite builds from the repository's canonical physical path (`C:\Users\iateadoor\AppData\Local\Temp\QuestAR-static-demo`). Invoking the same build through the `C:\Users\connors\AppData\Local\Temp` junction can make Rolldown emit an invalid absolute-ish `index.html` asset path. The clean Linux GitHub Actions runner is unaffected; the local workaround is to use the physical repo path for build and preview commands.
