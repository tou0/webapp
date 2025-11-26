/* ===========================================================
   Drown - Random Music Explorer
   Version structurée, commentée et prête pour extension PWA
   =========================================================== */

// Sélecteurs HTML
const btnRandom = document.getElementById("randomBtn");
const artistInfoDiv = document.getElementById("artistInfo");
const historyList = document.getElementById("history");

// Clé localStorage
const HISTORY_KEY = "drown-history";

// -----------------------------------------------------------
// Fonction : Charger l'historique depuis le localStorage
// -----------------------------------------------------------
function loadHistory() {
    console.log("[HISTORY] Chargement de l'historique depuis localStorage...");

    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) {
        console.log("[HISTORY] Aucun historique trouvé.");
        return [];
    }

    try {
        const parsed = JSON.parse(data);
        console.log("[HISTORY] Historique chargé :", parsed);
        return parsed;
    } catch (err) {
        console.error("[HISTORY] Erreur JSON :", err);
        return [];
    }
}

// -----------------------------------------------------------
// Fonction : Sauvegarder un artiste dans l'historique
// -----------------------------------------------------------
function saveToHistory(artistName, imgUrl) {
    console.log(`[HISTORY] Sauvegarde de : ${artistName}`);

    const history = loadHistory();

    history.unshift({
        name: artistName,
        img: imgUrl,
        date: new Date().toLocaleString()
    });

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    updateHistoryUI();
}

// -----------------------------------------------------------
// Fonction : Afficher l'historique à l'écran
// -----------------------------------------------------------
function updateHistoryUI() {
    console.log("[HISTORY] Mise à jour de l'affichage de l'historique...");

    const history = loadHistory();
    historyList.innerHTML = "";

    history.forEach(item => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex align-items-center";

        li.innerHTML = `
            <img src="${item.img}" width="50" class="me-2 rounded">
            <strong>${item.name}</strong>
            <span class="ms-auto text-muted">${item.date}</span>
        `;

        historyList.appendChild(li);
    });
}

// Charger l'historique au démarrage
updateHistoryUI();

// ===========================================================
// API CALLS — Fonctions séparées
// ===========================================================

// MusicBrainz : tirer un artiste random
async function fetchRandomArtistFromMusicBrainz() {
    const offset = Math.floor(Math.random() * 120000);
    console.log(`[API] Tirage MusicBrainz à l'offset ${offset}`);

    const res = await fetch(
        `https://musicbrainz.org/ws/2/artist?query=artist:*&fmt=json&limit=1&offset=${offset}`
    );

    const data = await res.json();
    console.log("[API] Réponse MusicBrainz :", data);

    if (!data.artists || data.artists.length === 0) return null;

    return data.artists[0].name;
}

// TheAudioDB : infos artistes
async function fetchArtistFromAudioDB(name) {
    console.log(`[API] Recherche TheAudioDB pour "${name}"`);

    const res = await fetch(
        `https://theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`
    );

    const data = await res.json();
    console.log("[API] Réponse TheAudioDB :", data);

    if (!data.artists) return null;
    return data.artists[0];
}

// Albums
async function fetchAlbums(idArtist) {
    console.log(`[API] Récupération albums pour ID ${idArtist}`);

    const res = await fetch(
        `https://theaudiodb.com/api/v1/json/2/album.php?i=${idArtist}`
    );

    const data = await res.json();
    console.log("[API] Réponse albums :", data);

    return data.album || [];
}

// Top tracks
async function fetchTopTracks(name) {
    console.log(`[API] Récupération top tracks pour "${name}"`);

    const res = await fetch(
        `https://theaudiodb.com/api/v1/json/2/track-top10.php?s=${encodeURIComponent(name)}`
    );

    const data = await res.json();
    console.log("[API] Réponse top tracks :", data);

    return data.track || [];
}

// ===========================================================
// Fonction principale : Générer un artiste complet
// ===========================================================

async function generateRandomArtist() {
    console.log("=== [START] Génération d'un artiste aléatoire ===");

    artistInfoDiv.innerHTML = "⏳ Chargement...";

    try {
        let artistName = null;
        let artistInfo = null;

        // 10 tentatives max pour trouver un artiste AVEC image
        for (let attempt = 1; attempt <= 10; attempt++) {
            console.log(`[TRY] Tentative ${attempt}/10...`);

            artistName = await fetchRandomArtistFromMusicBrainz();
            if (!artistName) continue;

            artistInfo = await fetchArtistFromAudioDB(artistName);

            if (artistInfo && artistInfo.strArtistThumb) break;
        }

        if (!artistInfo) {
            artistInfoDiv.innerHTML = "❌ Aucun artiste trouvé après plusieurs tentatives.";
            return;
        }

        console.log("[SUCCESS] Artiste trouvé :", artistInfo);

        // Albums + top tracks
        const albums = await fetchAlbums(artistInfo.idArtist);
        const topTracks = await fetchTopTracks(artistInfo.strArtist);

        // -------------------------------------
        // Construction HTML
        // -------------------------------------
        let html = `
            <h2>${artistInfo.strArtist}</h2>
            <img src="${artistInfo.strArtistThumb}" class="img-fluid rounded shadow mb-3" alt="${artistInfo.strArtist}">
        `;

        const bestAlbum = albums.length > 0 ? albums[0].strAlbum : "N/A";
        html += `<p><strong>Meilleur album :</strong> ${bestAlbum}</p>`;

        html += `<h3>Top 10 Tracks</h3><ul>`;

        topTracks.forEach(track => {
            html += `<li>${track.strTrack}`;

            // Si vidéo YouTube disponible
            if (track.strMusicVid?.includes("youtube.com")) {
                try {
                    const url = new URL(track.strMusicVid);
                    const videoID = url.searchParams.get("v");

                    if (videoID) {
                        html += `<br><iframe width="300" height="150"
                                src="https://www.youtube.com/embed/${videoID}"
                                frameborder="0" allowfullscreen></iframe>`;
                    }
                } catch (err) {
                    console.warn("[VIDEO] URL invalide", err);
                }
            }

            html += `</li>`;
        });

        html += `</ul>`;

        artistInfoDiv.innerHTML = html;

        // Vibrations (API système)
        if ("vibrate" in navigator) {
            console.log("[DEVICE] Vibration courte");
            navigator.vibrate(50);
        }

        // Sauvegarde historique
        saveToHistory(artistInfo.strArtist, artistInfo.strArtistThumb);

    } catch (err) {
        console.error("[ERROR] Une erreur est survenue :", err);
        artistInfoDiv.innerHTML = "❌ Erreur lors du chargement.";
    }
}

// ===========================================================
// EVENT LISTENER
// ===========================================================

btnRandom.addEventListener("click", generateRandomArtist);

console.log("🎵 Drown - Script chargé avec succès !");
