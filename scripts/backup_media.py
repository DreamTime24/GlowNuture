"""Create a private media archive with a SHA-256 manifest; never overwrite a backup."""
import hashlib,json,os,sys,tarfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
from app.services.media import media_root
if len(sys.argv)!=2:raise SystemExit("Usage: python scripts/backup_media.py /absolute/private/media-backup.tar.gz")
target=Path(sys.argv[1]).resolve()
root=media_root().resolve()
if target.is_relative_to(root):raise SystemExit("Write the archive outside the media directory.")
if not root.is_dir():raise SystemExit("Configured media directory does not exist.")
files=[]
for path in sorted(root.rglob("*")):
    if path.is_symlink():raise SystemExit("Symbolic links are not permitted in the media backup.")
    if path.is_file():files.append(path)
if len(files)>50000:raise SystemExit("Split very large media stores into an approved storage backup system.")
target.parent.mkdir(parents=True,exist_ok=True)
try:fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
except FileExistsError:raise SystemExit("Backup already exists; it was not overwritten.") from None
try:
    manifest={"version":1,"files":[]}
    total=0
    with os.fdopen(fd,"wb") as output,tarfile.open(fileobj=output,mode="w:gz") as archive:
        for path in files:
            relative=path.relative_to(root).as_posix()
            raw=path.read_bytes()
            total+=len(raw)
            if len(raw)>20_000_000 or total>2_000_000_000:raise ValueError()
            manifest["files"].append({"path":relative,"size":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})
            import io
            info=tarfile.TarInfo("media/"+relative);info.size=len(raw);info.mode=0o640
            archive.addfile(info,io.BytesIO(raw))
        raw=json.dumps(manifest,separators=(",",":")).encode()
        info=tarfile.TarInfo("manifest.json");info.size=len(raw);info.mode=0o600
        archive.addfile(info,io.BytesIO(raw))
except Exception:
    target.unlink(missing_ok=True)
    raise SystemExit("Media backup failed; the incomplete new archive was removed.") from None
print("Media backup created with integrity manifest. Test restoration in a separate empty directory.")
