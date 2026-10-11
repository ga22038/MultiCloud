from pathlib import Path
import subprocess, shutil
tls = Path('.secrets/gcp/db/tls')
openssl = shutil.which('openssl')
def run(args):
    subprocess.run([openssl, *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if not (tls / 'ca.pem').exists() or not Path('.secrets/gcp/ca-key.pem').exists():
    run(['req','-x509','-newkey','rsa:3072','-nodes','-sha256','-days','365','-subj','/CN=Polaris UES Database CA','-keyout','.secrets/gcp/ca-key.pem','-out',str(tls / 'ca.pem')])
if not (tls / 'server-cert.pem').exists():
    run(['req','-newkey','rsa:3072','-nodes','-sha256','-subj','/CN=polaris-ues-gcp-mariadb','-keyout',str(tls / 'server-key.pem'),'-out','.secrets/gcp/server.csr'])
    Path('.secrets/gcp/server.ext').write_text('subjectAltName=IP:10.20.1.3,DNS:polaris-ues-gcp-mariadb\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n')
    run(['x509','-req','-in','.secrets/gcp/server.csr','-CA',str(tls / 'ca.pem'),'-CAkey','.secrets/gcp/ca-key.pem','-CAcreateserial','-out',str(tls / 'server-cert.pem'),'-days','365','-sha256','-extfile','.secrets/gcp/server.ext'])
shutil.copyfile(tls / 'ca.pem', '.secrets/gcp/app/database-ca/ca.pem')
shutil.copyfile('infra/compose/gcp-database.yaml', '.secrets/gcp/db/compose.yaml')
print('Certificados generados; CA privada permanece local.')
