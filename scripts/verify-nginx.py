from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
nginx = root/'.tools/nginx-1.28.0'
target = root/'tmp/nginx-check.conf'
conf = (root/'infra/nginx/local.conf').read_text(encoding='utf-8')
conf = conf.replace('/etc/nginx/mime.types', '"'+(nginx/'conf/mime.types').as_posix()+'"')
conf = conf.replace('/var/log/nginx/access.log', '"'+(root/'tmp/nginx-check-access.log').as_posix()+'"')
target.write_text(conf, encoding='utf-8')
result = subprocess.run([str(nginx/'nginx.exe'), '-p', nginx.as_posix()+'/', '-c', target.as_posix(), '-t'], capture_output=True, text=True)
print(result.stderr.strip())
raise SystemExit(result.returncode)
