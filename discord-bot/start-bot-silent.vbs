' Double-click to run the bot in the background (no window). Restarts automatically if it crashes.
Set fso = CreateObject("Scripting.FileSystemObject")
batPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "start-bot.bat")
CreateObject("Wscript.Shell").Run """" & batPath & """", 0, False
