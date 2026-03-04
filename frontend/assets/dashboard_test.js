async function refreshCards() {
try{
    const [temp, soil, light] = await Promise.all([
        AIOT.apiGet("api/env/latest",{signal:"temperature"}),
        AIOT.apiGet("api/agri",{signal:"soil_moisture"}),
        AIOT.apiGet("api/env/latest",{signal:"light"}) ,   
    ]);



   if (temp?.value) document.getElementById("tempValue").textContent  = `${temp.value} °C`;
   if (soil?.value) document.getElementById("soilValue").textContent  = `${soil.value} %`;
   if (light?.value)document.getElementById("lightValue").textContent = `${light.value} lux`;
} catch (error) {
    console.error("Error refreshing cards:", error);
}


}

// apel initital + refresh la 10s

refreshCards();
setInterval(refreshCards, 10000);