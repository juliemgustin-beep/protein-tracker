const LS_KEY="protein_log_v1"
const PROTEIN_GOAL=100

let chart

const photoEl=document.getElementById("photo")
const preview=document.getElementById("preview")
const analyzeBtn=document.getElementById("analyzeBtn")
const clearBtn=document.getElementById("clearBtn")
const statusEl=document.getElementById("status")
const resultEl=document.getElementById("result")
const logEl=document.getElementById("log")
const todayTotalEl=document.getElementById("todayTotal")
const weekTotalEl=document.getElementById("weekTotal")

function isoDate(d=new Date()){
return d.toISOString().slice(0,10)
}

function loadLog(){
return JSON.parse(localStorage.getItem(LS_KEY)||"[]")
}

function saveLog(entries){
localStorage.setItem(LS_KEY,JSON.stringify(entries))
}

function lastNDays(n){
const days=[]
const now=new Date()

for(let i=0;i<n;i++){
const d=new Date(now)
d.setDate(now.getDate()-i)
days.push(isoDate(d))
}

return days
}

function calcTotals(entries){

const today=isoDate()

const todayTotal=entries
.filter(e=>e.date===today)
.reduce((sum,e)=>sum+e.total_protein_g,0)

const weekTotal=entries
.filter(e=>lastNDays(7).includes(e.date))
.reduce((sum,e)=>sum+e.total_protein_g,0)

todayTotalEl.textContent=Math.round(todayTotal)+"g"
weekTotalEl.textContent=Math.round(weekTotal)+"g"

const remaining=Math.max(PROTEIN_GOAL-todayTotal,0)

document.getElementById("remaining").textContent=
remaining+"g remaining"

const progress=Math.min(todayTotal/PROTEIN_GOAL,1)

document.getElementById("progressBar").style.width=
progress*100+"%"

}

function renderLog(entries){

logEl.innerHTML=entries
.slice()
.reverse()
.map(e=>`
<div>
<b>${e.total_protein_g}g</b> • ${e.date}
<br/>
${e.foods.map(f=>`${f.name} (${f.protein_g}g)`).join(", ")}
</div>
`).join("<br/>")

}

async function analyzeImage(dataUrl){

const resp=await fetch("/.netlify/functions/analyze",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({image_data_url:dataUrl})
})

return resp.json()

}

photoEl.addEventListener("change", async () => {

  const file = photoEl.files[0]
  if (!file) return

  statusEl.textContent = "Preparing image..."

  const reader = new FileReader()

  reader.onload = async e => {

    preview.src = e.target.result
    preview.style.display = "block"

    statusEl.textContent = "Ready to analyze"

  }

  reader.readAsDataURL(file)

})

analyzeBtn.addEventListener("click", async () => {

  const file = photoEl.files[0]
  if (!file) {
    statusEl.textContent = "Take a photo first"
    return
  }

  statusEl.textContent = "Analyzing..."

  const reader = new FileReader()

  reader.onload = async e => {

    const data = await analyzeImage(e.target.result)

    if (!data || !data.total_protein_g) {
      statusEl.textContent = "AI analysis failed"
      return
    }

    const entries = loadLog()

    entries.push({
      date: isoDate(),
      foods: data.foods,
      total_protein_g: data.total_protein_g
    })

    saveLog(entries)
    refreshUI()

    statusEl.textContent = "Saved"

  }

  reader.readAsDataURL(file)

})

const file=photoEl.files[0]
if(!file)return

statusEl.textContent="Analyzing..."

const reader=new FileReader()

reader.onload = async e => {

  const img = new Image()
  img.src = e.target.result

  img.onload = async () => {

    const canvas = document.createElement("canvas")
    const maxSize = 800

    let width = img.width
    let height = img.height

    if (width > height && width > maxSize) {
      height *= maxSize / width
      width = maxSize
    } else if (height > maxSize) {
      width *= maxSize / height
      height = maxSize
    }

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0, width, height)

    const compressed = canvas.toDataURL("image/jpeg", 0.7)

    const data = await analyzeImage(compressed)

    if (!data.total_protein_g) {
      statusEl.textContent = "AI analysis failed. Try another photo."
      return
    }

    const entries = loadLog()

    entries.push({
      date: isoDate(),
      foods: data.foods,
      total_protein_g: data.total_protein_g
    })

    saveLog(entries)
    refreshUI()

    statusEl.textContent = "Saved"

  }

}
const data=await analyzeImage(e.target.result)

if (!data.total_protein_g) {
  statusEl.textContent = "AI analysis failed. Try another photo.";
  return;
}

const entries=loadLog()

entries.push({
date:isoDate(),
foods:data.foods,
total_protein_g:data.total_protein_g
})

saveLog(entries)

refreshUI()

statusEl.textContent="Saved"

}

reader.readAsDataURL(file)

})

clearBtn.addEventListener("click",()=>{
localStorage.removeItem(LS_KEY)
refreshUI()
})

function renderChart(entries){

const days=lastNDays(7).reverse()

const totals=days.map(day=>
entries
.filter(e=>e.date===day)
.reduce((sum,e)=>sum+e.total_protein_g,0)
)

const ctx=document.getElementById("proteinChart")

if(!ctx)return

if(chart)chart.destroy()

chart=new Chart(ctx,{
type:"bar",
data:{
labels:days.map(d=>d.slice(5)),
datasets:[{data:totals,borderRadius:10}]
},
options:{
plugins:{legend:{display:false}},
scales:{y:{beginAtZero:true}}
}
})

}

function refreshUI(){
const entries=loadLog()
calcTotals(entries)
renderLog(entries)
renderChart(entries)
}

refreshUI()
