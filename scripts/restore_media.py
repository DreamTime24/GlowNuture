"""Restore a manifest-checked archive into a NEW directory. Never modify live media."""
import hashlib,json,os,shutil,sys,tarfile
from pathlib import Path,PurePosixPath
if len(sys.argv)!=3:raise SystemExit("Usage: python scripts/restore_media.py backup.tar.gz /new/empty/restore-directory")
source=Path(sys.argv[1]).resolve();target=Path(sys.argv[2]).resolve()
if target.exists():raise SystemExit("Target must not exist; existing media was not touched.")
target.mkdir(parents=True,mode=0o750,exist_ok=False)
try:
    with tarfile.open(source,"r:gz") as archive:
        members=archive.getmembers()
        if len(members)>50001:raise ValueError()
        names=[m.name for m in members]
        if len(set(names))!=len(names) or "manifest.json" not in names:raise ValueError()
        info=archive.getmember("manifest.json")
        if not info.isfile() or info.size>12_000_000:raise ValueError()
        manifest=json.load(archive.extractfile(info))
        if manifest.get("version")!=1:raise ValueError()
        expected={entry["path"]:entry for entry in manifest["files"]}
        if len(expected)!=len(manifest["files"]) or len(expected)!=len(members)-1:raise ValueError()
        total=0
        for member in members:
            if member.name=="manifest.json":continue
            if not member.isfile() or not member.name.startswith("media/"):raise ValueError()
            relative=member.name.removeprefix("media/")
            path=PurePosixPath(relative)
            if not relative or path.is_absolute() or ".." in path.parts or "\\" in relative or any(ord(c)<32 for c in relative):raise ValueError()
            entry=expected.get(relative)
            total+=member.size
            if not entry or member.size!=entry["size"] or member.size>20_000_000 or total>2_000_000_000:raise ValueError()
            destination=(target/relative).resolve()
            if not destination.is_relative_to(target):raise ValueError()
            raw=archive.extractfile(member).read(member.size+1)
            if len(raw)!=member.size or hashlib.sha256(raw).hexdigest()!=entry["sha256"]:raise ValueError()
            destination.parent.mkdir(parents=True,exist_ok=True)
            fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o640)
            with os.fdopen(fd,"wb") as output:output.write(raw)
except Exception:
    # Only this newly created restoration directory is removed.
    shutil.rmtree(target)
    raise SystemExit("Restore rejected: invalid archive, manifest, path or checksum. Live media was not touched.") from None
print("Media restored and every checksum verified. Validate with a matching database backup before any approved cutover.")
