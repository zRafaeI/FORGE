"""
Gera src/lib/content/verses.ts a partir da Bíblia Livre (eBible.org, porbr2018, CC BY 4.0).

Uso (na raiz do projeto):
  1. Baixe o texto e o índice de referências (um versículo por linha, alinhados):
       https://raw.githubusercontent.com/BibleNLP/ebible/main/corpus/por-porbr2018.txt
       https://raw.githubusercontent.com/BibleNLP/ebible/main/metadata/vref.txt
     e salve em scripts/.cache/
  2. Edite scripts/verse-refs.txt (uma referência por linha, ex.: "PSA 23:1" ou "PHP 4:6-7").
  3. python3 scripts/build-verses.py
"""
import re, json, random, sys, os
BOOKS={"GEN":"Gênesis","EXO":"Êxodo","NUM":"Números","DEU":"Deuteronômio","JOS":"Josué","RUT":"Rute","1SA":"1 Samuel","2SA":"2 Samuel","1KI":"1 Reis","1CH":"1 Crônicas","2CH":"2 Crônicas","NEH":"Neemias","JOB":"Jó","PSA":"Salmos","PRO":"Provérbios","ECC":"Eclesiastes","ISA":"Isaías","JER":"Jeremias","LAM":"Lamentações","EZK":"Ezequiel","DAN":"Daniel","HOS":"Oseias","JOL":"Joel","MIC":"Miqueias","NAM":"Naum","HAB":"Habacuque","ZEP":"Sofonias","ZEC":"Zacarias","MAL":"Malaquias","MAT":"Mateus","MRK":"Marcos","LUK":"Lucas","JHN":"João","ACT":"Atos","ROM":"Romanos","1CO":"1 Coríntios","2CO":"2 Coríntios","GAL":"Gálatas","EPH":"Efésios","PHP":"Filipenses","COL":"Colossenses","1TH":"1 Tessalonicenses","2TH":"2 Tessalonicenses","1TI":"1 Timóteo","2TI":"2 Timóteo","TIT":"Tito","HEB":"Hebreus","JAS":"Tiago","1PE":"1 Pedro","2PE":"2 Pedro","1JN":"1 João","3JN":"3 João","JUD":"Judas","REV":"Apocalipse"}
HERE=os.path.dirname(os.path.abspath(__file__))
CACHE=os.path.join(HERE,".cache")
refs_lines=open(os.path.join(CACHE,"vref.txt"),encoding="utf-8").read().splitlines()
text_lines=open(os.path.join(CACHE,"por-porbr2018.txt"),encoding="utf-8").read().splitlines()
assert len(refs_lines)==len(text_lines), "arquivos desalinhados"
verses={r.strip():t.strip() for r,t in zip(refs_lines,text_lines)}
# Erros de digitação do texto-fonte corrigidos (encontrados por verificação ortográfica).
ERRATA = {
    "PSA 34:18": [("e sava os aflitos", "e salva os aflitos")],
    "2TI 2:15": [("a Deuscomo", "a Deus como")],
}
out=[]; problems=[]
for r in open(os.path.join(HERE,"verse-refs.txt")):
    r=r.strip()
    if not r: continue
    m=re.match(r"(\w+) (\d+):(\d+)(?:-(\d+))?$",r); b,c,v1,v2=m.group(1),int(m.group(2)),int(m.group(3)),m.group(4)
    v2=int(v2) if v2 else v1
    parts=[verses.get(f"{b} {c}:{v}","") for v in range(v1,v2+1)]
    if b=="PSA" and c==119:                                 # títulos das estrofes (letras hebraicas)
        parts=[re.sub(r"^[A-ZÀ-Úa-zà-ú]+\s*:\s*","",p) for p in parts]
    for key in [f"{b} {c}:{v}" for v in range(v1,v2+1)]:
        for wrong,right in ERRATA.get(key,[]):
            parts=[p.replace(wrong,right) for p in parts]
    if any(not p or p=="<range>" for p in parts): problems.append(("vazio",r,parts)); continue
    FUNC={"E","Mas","Porque","Pois","O","A","Os","As","Que","Para","Com","Em","Se","Nem","Ou","Porém","Então","Assim"}
    joined=parts[0]
    for part in parts[1:]:
        first=part.split(" ",1)[0]
        if joined.rstrip().endswith((";",",",":")) and first in FUNC:
            part=part[0].lower()+part[1:]
        joined+=" "+part
    text=joined
    text=re.sub(r"\s+"," ",text).strip()
    text=re.sub(r"\s*\(Selá\)","",text).strip()
    text=re.sub(r"\s*\(Para o (regente|mestre de música|músico)[^)]*\)\.?$","",text).strip()  # notas musicais
    text=re.sub(r"\s+([,;:.!?])",r"\1",text)               # espaço antes de pontuação          # marcação litúrgica dos Salmos
    m2=re.match(r"^\((.*)\)([.!?]?)$",text)                 # versículo inteiro entre parênteses
    if m2: text=m2.group(1)+(m2.group(2) or ".")
    text=text[0].upper()+text[1:]                           # começa com maiúscula
    if text.count("“")!=text.count("”"):                    # aspas abertas/fechadas em outro versículo
        text=text.replace("“","").replace("”","")
    text=re.sub(r"[;,:]$",".",text)                         # versículo isolado termina com ponto
    if len(text)>420: problems.append(("longo",r,len(text)))
    label=f"{BOOKS[b]} {c}:{v1}"+(f"-{v2}" if v2!=v1 else "")
    out.append({"ref":label,"text":text,"usfm":r})
print("total",len(out)); print("problemas",len(problems))
for p in problems: print(p)
lens=sorted(len(o["text"]) for o in out); print("tam min/mediana/max",lens[0],lens[len(lens)//2],lens[-1])
random.seed(20261123); random.shuffle(out)
HEADER = open(os.path.join(HERE, "verses-header.ts.txt"), encoding="utf-8").read()
body = "\n".join("  { ref: %s, text: %s }," % (json.dumps(o["ref"], ensure_ascii=False), json.dumps(o["text"], ensure_ascii=False)) for o in out)
target = os.path.join(HERE, "..", "src", "lib", "content", "verses.ts")
open(target, "w", encoding="utf-8").write(HEADER + body + "\n];\n")
print("gerado:", target)
