"""Local backup to an explicit private file. No automatic upload or credential output."""
import os,subprocess,sqlite3
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"backend"))
from app.core.config import get_settings
from sqlalchemy.engine import make_url
if len(sys.argv)!=2:raise SystemExit("Usage: python scripts/backup_database.py /absolute/private/backup-path")
target=Path(sys.argv[1]).resolve()
url=make_url(get_settings().database_url)
if url.get_backend_name() not in {"sqlite","postgresql"}:raise SystemExit("Only SQLite and PostgreSQL backups are supported.")
target.parent.mkdir(parents=True,exist_ok=True)
try:fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
except FileExistsError:raise SystemExit("Backup path already exists; it will not be overwritten.") from None
try:
    if url.get_backend_name()=="sqlite":
        source=Path(url.database).resolve()
        with sqlite3.connect("file:"+str(source)+"?mode=ro",uri=True) as original:
            with sqlite3.connect(target) as backup:original.backup(backup)
    else:
        env={**os.environ,"PGPASSWORD":url.password or ""}
        names={"sslmode":"PGSSLMODE","sslrootcert":"PGSSLROOTCERT","sslcert":"PGSSLCERT","sslkey":"PGSSLKEY","channel_binding":"PGCHANNELBINDING","connect_timeout":"PGCONNECT_TIMEOUT"}
        for key,name in names.items():
            if key in url.query:env[name]=url.query[key]
        command=["pg_dump","--format=custom","--file",str(target),"--host",url.host or "localhost","--port",str(url.port or 5432),"--username",url.username or "","--dbname",url.database]
        subprocess.run(command,env=env,check=True,capture_output=True)
    os.chmod(target,0o600)
except Exception:
    target.unlink(missing_ok=True)
    raise SystemExit("Backup failed; check database connectivity, private target permissions and pg_dump if applicable. Credentials were not logged.") from None
print("Backup created. Preserve encryption keys separately and verify restoration before relying on it.")
