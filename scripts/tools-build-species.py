import json, pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
OLD=json.loads((ROOT/'assets/js/species.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))[:251]
TYPES=['','normal','fighting','flying','poison','ground','rock','bug','ghost','steel','fire','water','grass','electric','psychic','ice','dragon','dark','fairy']
LEGENDARY=set([377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493])
NAMES={'deoxys-normal':'Deoxys','wormadam-plant':'Wormadam','giratina-altered':'Giratina','shaymin-land':'Shaymin','mime-jr':'Mime Jr.','porygon-z':'Porygon-Z'}
OUT=[]
for id,row in enumerate((ROOT/'assets/data/gen3-4-stats.csv').read_text(encoding='utf-8').splitlines(),start=252):
 fields=row.split(',');name=fields[0];nums=list(map(int,fields[1:]));assert len(nums) in (7,8), (id,fields)
 n=NAMES.get(name,' '.join(part.capitalize() for part in name.split('-')))
 OUT.append({'id':id,'name':n,'types':[TYPES[i] for i in nums[6:]],'baseStats':dict(zip(['hp','attack','defense','spAttack','spDefense','speed'],nums[:6])),'legendary':id in LEGENDARY})
assert len(OUT)==242 and OUT[-1]['id']==493
combined=OLD+OUT
assert [s['id'] for s in combined]==list(range(1,494))
(ROOT/'assets/js/species.js').write_text('/* National Pokédex #001–493, PokeAPI default-form base stats/types. Gen I–II preserved. */\nwindow.FXI_SPECIES='+json.dumps(combined,separators=(',',':'),ensure_ascii=False)+';\n',encoding='utf8')
print('Wrote',len(combined),'Pokemon species',sum(s['legendary'] for s in combined),'Legendary/Mythical')
