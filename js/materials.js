export const MATERIALS = [
  {id:0, name:'Air',     color:null,      solid:false, hard:0, value:0,  weight:0},
  {id:1, name:'Grass',   color:'#1fa94c', solid:true,  hard:1, value:0,  weight:1},
  {id:2, name:'Dirt',    color:'#7b5134', solid:true,  hard:1, value:0,  weight:1},
  // Stone and ores
  {id:3, name:'Stone',   color:'#808a99', solid:true,  hard:2, value:1,  weight:2, rarity:80, minDepth:22},
  {id:4, name:'Copper',  color:'#c67c29', solid:true,  hard:3, value:5,  weight:3, rarity:20, minDepth:30,  ore:true},
  {id:5, name:'Iron',    color:'#8d8d92', solid:true,  hard:4, value:10, weight:4, rarity:10, minDepth:60,  ore:true},
  {id:6, name:'Gold',    color:'#ffcc33', solid:true,  hard:6, value:30, weight:6, rarity:5,  minDepth:120, ore:true},
  {id:7, name:'Tin',     color:'#c4d5d5', solid:true,  hard:3, value:8,  weight:3, rarity:15, minDepth:40,  ascension:1, ore:true},
  {id:8, name:'Diamond', color:'#00d0ff', solid:true,  hard:9, value:100,weight:1, rarity:1,  minDepth:300, ascension:1, ore:true}
];

// Mapping from ore id to bar id
export const BAR_MAP = {};

// Automatically generate bar variants for ores
const base = MATERIALS.slice();
for (const mat of base) {
  if (!mat.ore) continue;
  const id = MATERIALS.length;
  const bar = {
    id,
    name: mat.name + ' Bar',
    color: mat.color,
    solid: false,
    hard: 0,
    value: mat.value * 3,
    weight: mat.weight,
    barFor: mat.id
  };
  MATERIALS.push(bar);
  BAR_MAP[mat.id] = id;
}

