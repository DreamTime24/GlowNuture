"""Create fresh local settings once without overwriting or printing credentials."""
import argparse,os,secrets
from pathlib import Path
from cryptography.fernet import Fernet
parser=argparse.ArgumentParser();parser.add_argument("--local-auth",action="store_true");args=parser.parse_args()
root=Path(__file__).resolve().parents[1];target=root/"backend"/".env"
if target.exists():raise SystemExit("backend/.env exists; it was not overwritten.")
text=(root/".env.example").read_text(encoding="utf8").replace("REPLACE_WITH_FERNET_KEY",Fernet.generate_key().decode()).replace("REPLACE_WITH_64_HEX_CHAR_SECRET",secrets.token_hex(32))
if args.local_auth:text=text.replace("LOCAL_AUTH_ENABLED=false","LOCAL_AUTH_ENABLED=true")
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,"w",encoding="utf8") as stream:stream.write(text)
print("Fresh local encryption settings created. Configure seller details before opening checkout.")
