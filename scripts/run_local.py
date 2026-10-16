"""Run the local API and both workers together; stop child processes on exit."""
import os,signal,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
children=[]
def cleanup():
    for child in children:
        if child.poll() is None:child.terminate()
    for child in children:
        try:child.wait(timeout=8)
        except subprocess.TimeoutExpired:child.kill()
def stop(signum,*_):
    cleanup()
    raise SystemExit(128+signum)
signal.signal(signal.SIGINT,stop)
signal.signal(signal.SIGTERM,stop)
exit_code=0
try:
    subprocess.run([sys.executable,"-m","alembic","upgrade","head"],cwd=ROOT/"backend",check=True)
    for command in [["uvicorn","app.main:app","--host","127.0.0.1","--port","8000"],["app.worker"],["app.catalog_worker"]]:
        children.append(subprocess.Popen([sys.executable,"-m",*command],cwd=ROOT/"backend"))
    print("Local shop: http://127.0.0.1:8000 · API + notification worker + catalog worker",flush=True)
    while True:
        if any(child.poll() is not None for child in children):
            exit_code=1
            print("A local service stopped; stopping the remaining services.",flush=True)
            break
        time.sleep(1)
finally:
    cleanup()
raise SystemExit(exit_code)
