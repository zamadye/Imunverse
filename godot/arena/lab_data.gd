# lab_data.gd — GENERATED oleh tools/godot/gen-lab-gd.mjs dari
# data/lumen-labyrinth.json. JANGAN edit manual.
extends RefCounted

const NODES := [
  { "id": "kapiler", "x": 640.0, "y": 1560.0, "r": 88.0, "junction": false, "enemies": 4, "hazard": "" },
  { "id": "j1", "x": 640.0, "y": 1330.0, "r": 60.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "usus_halus", "x": 400.0, "y": 1240.0, "r": 160.0, "junction": false, "enemies": 6, "hazard": "mucus" },
  { "id": "usus_besar", "x": 1060.0, "y": 1360.0, "r": 150.0, "junction": false, "enemies": 6, "hazard": "mucus" },
  { "id": "j2", "x": 800.0, "y": 1150.0, "r": 60.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "ginjal", "x": 900.0, "y": 1000.0, "r": 140.0, "junction": false, "enemies": 6, "hazard": "" },
  { "id": "j3", "x": 520.0, "y": 1040.0, "r": 60.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "pankreas", "x": 620.0, "y": 890.0, "r": 120.0, "junction": false, "enemies": 5, "hazard": "" },
  { "id": "hati", "x": 330.0, "y": 760.0, "r": 150.0, "junction": false, "enemies": 7, "hazard": "bile" },
  { "id": "aliran_darah", "x": 1180.0, "y": 860.0, "r": 120.0, "junction": false, "enemies": 6, "hazard": "" },
  { "id": "j4", "x": 860.0, "y": 780.0, "r": 60.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "lambung", "x": 1020.0, "y": 620.0, "r": 150.0, "junction": false, "enemies": 7, "hazard": "acid" },
  { "id": "j5", "x": 560.0, "y": 640.0, "r": 60.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "limfe", "x": 700.0, "y": 470.0, "r": 110.0, "junction": false, "enemies": 5, "hazard": "" },
  { "id": "saraf", "x": 250.0, "y": 430.0, "r": 110.0, "junction": false, "enemies": 6, "hazard": "" },
  { "id": "paru", "x": 430.0, "y": 240.0, "r": 160.0, "junction": false, "enemies": 7, "hazard": "" },
  { "id": "j6", "x": 640.0, "y": 320.0, "r": 62.0, "junction": true, "enemies": 0, "hazard": "" },
  { "id": "jantung", "x": 800.0, "y": 180.0, "r": 210.0, "junction": false, "enemies": 10, "hazard": "" },
  { "id": "goal", "x": 1090.0, "y": 140.0, "r": 82.0, "junction": false, "enemies": 0, "hazard": "" },
]

const EDGES := [
  { "a": "kapiler", "b": "j1", "w": 34.0, "pts": [Vector2(640, 1560), Vector2(670, 1445), Vector2(700, 1445), Vector2(640, 1330)] },
  { "a": "j1", "b": "usus_halus", "w": 34.0, "pts": [Vector2(640, 1330), Vector2(507.7106795444063, 1317.7715212149164), Vector2(495.42135908881255, 1350.5430424298331), Vector2(400, 1240)] },
  { "a": "j1", "b": "usus_besar", "w": 34.0, "pts": [Vector2(640, 1330), Vector2(847.5063532504232, 1379.9110544940756), Vector2(845.0127065008463, 1414.8221089881515), Vector2(1060, 1360)] },
  { "a": "usus_halus", "b": "j3", "w": 34.0, "pts": [Vector2(400, 1240), Vector2(434.2752122286237, 1124.565127337174), Vector2(408.55042445724735, 1109.1302546743484), Vector2(520, 1040)] },
  { "a": "usus_besar", "b": "j2", "w": 34.0, "pts": [Vector2(1060, 1360), Vector2(948.8501132126287, 1231.6617645938884), Vector2(967.7002264252573, 1208.3235291877768), Vector2(800, 1150)] },
  { "a": "j2", "b": "ginjal", "w": 34.0, "pts": [Vector2(800, 1150), Vector2(827.1186169057092, 1059.745744603806), Vector2(804.2372338114186, 1044.4914892076124), Vector2(900, 1000)] },
  { "a": "j2", "b": "j3", "w": 34.0, "pts": [Vector2(800, 1150), Vector2(669.1413093105748, 1071.7312126639913), Vector2(678.2826186211497, 1048.4624253279826), Vector2(520, 1040)] },
  { "a": "j3", "b": "pankreas", "w": 34.0, "pts": [Vector2(520, 1040), Vector2(545.0384911698646, 948.3589941132432), Vector2(520.0769823397294, 931.7179882264862), Vector2(620, 890)] },
  { "a": "pankreas", "b": "j5", "w": 34.0, "pts": [Vector2(620, 890), Vector2(616.7406508044643, 758.5822438069285), Vector2(643.4813016089284, 752.1644876138572), Vector2(560, 640)] },
  { "a": "j5", "b": "hati", "w": 34.0, "pts": [Vector2(560, 640), Vector2(460.0333952175881, 728.8140075003773), Vector2(475.0667904351763, 757.6280150007545), Vector2(330, 760)] },
  { "a": "hati", "b": "saraf", "w": 34.0, "pts": [Vector2(330, 760), Vector2(265.7037473577824, 600.8900006405376), Vector2(241.40749471556478, 606.7800012810752), Vector2(250, 430)] },
  { "a": "saraf", "b": "paru", "w": 34.0, "pts": [Vector2(250, 430), Vector2(359.96369880741025, 353.91297781754656), Vector2(379.92739761482045, 372.82595563509307), Vector2(430, 240)] },
  { "a": "paru", "b": "j6", "w": 34.0, "pts": [Vector2(430, 240), Vector2(545.6798598277596, 251.96536795213095), Vector2(556.3597196555193, 223.9307359042619), Vector2(640, 320)] },
  { "a": "j5", "b": "limfe", "w": 34.0, "pts": [Vector2(560, 640), Vector2(647.3684303013836, 569.3034131893747), Vector2(664.7368606027673, 583.6068263787495), Vector2(700, 470)] },
  { "a": "limfe", "b": "j6", "w": 34.0, "pts": [Vector2(700, 470), Vector2(649.1092744550816, 403.35629021796734), Vector2(628.2185489101633, 411.7125804359347), Vector2(640, 320)] },
  { "a": "ginjal", "b": "j4", "w": 34.0, "pts": [Vector2(900, 1000), Vector2(904.5967477524977, 885.5278640450005), Vector2(929.1934955049953, 881.0557280900008), Vector2(860, 780)] },
  { "a": "j4", "b": "lambung", "w": 34.0, "pts": [Vector2(860, 780), Vector2(920.55456351737, 680.55456351737), Vector2(901.1091270347399, 661.1091270347399), Vector2(1020, 620)] },
  { "a": "lambung", "b": "j6", "w": 34.0, "pts": [Vector2(1020, 620), Vector2(848.5893286573706, 446.45351703399723), Vector2(867.1786573147413, 422.90703406799446), Vector2(640, 320)] },
  { "a": "j6", "b": "jantung", "w": 34.0, "pts": [Vector2(640, 320), Vector2(706.8299078426296, 234.94846610586245), Vector2(693.6598156852593, 219.8969322117249), Vector2(800, 180)] },
  { "a": "jantung", "b": "goal", "w": 34.0, "pts": [Vector2(800, 180), Vector2(948.4159349284258, 184.76552823108688), Vector2(951.8318698568515, 209.53105646217375), Vector2(1090, 140)] },
  { "a": "ginjal", "b": "aliran_darah", "w": 34.0, "pts": [Vector2(900, 1000), Vector2(1050.062305898749, 950.1246117974981), Vector2(1060.1246117974981, 970.2492235949962), Vector2(1180, 860)] },
  { "a": "aliran_darah", "b": "lambung", "w": 34.0, "pts": [Vector2(1180, 860), Vector2(1079.198742641554, 753.8675049056308), Vector2(1058.397485283108, 767.7350098112614), Vector2(1020, 620)] },
  { "a": "usus_besar", "b": "goal", "w": 34.0, "pts": [Vector2(1060, 1360), Vector2(1119.9864009533017, 751.1062229742615), Vector2(1164.9728019066033, 752.212445948523), Vector2(1090, 140)] },
  { "a": "ginjal", "b": "lambung", "w": 34.0, "pts": [Vector2(900, 1000), Vector2(998.1433066053656, 822.0452547174839), Vector2(1036.2866132107313, 834.0905094349678), Vector2(1020, 620)] },
]

const ROUTE := ["kapiler", "j1", "j2", "ginjal", "j4", "lambung", "j6", "jantung", "goal"]
