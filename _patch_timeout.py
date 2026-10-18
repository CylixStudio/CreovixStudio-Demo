from pathlib import Path
p = Path(r"E:/Store/Cylix/CylixStudio-Demo/src/lib/kickChatDeliver.ts")
t = p.read_text(encoding="utf-8")
old = "const signal = AbortSignal.timeout(4_000);"
new = "const signal = AbortSignal.timeout(2_500);"
if old not in t:
    raise SystemExit("timeout line missing")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("timeout -> 2500")
