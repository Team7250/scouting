import { db } from "../firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TBA_KEY = "0n75QTuNDDuPGQ42UG8GDbxmVlPGtCMnd67fSCcH04AgVMSWwgJPCdtRwjiKYO9b";
const TEAM    = "frc7250";

async function fetchEvents() {
    try {
        const res = await fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM}/events/2026`,
            { headers: { "X-TBA-Auth-Key": TBA_KEY } });
        return res.ok ? await res.json() : [];
    } catch {
        return [];
    }
}

// Firestore collection path: e.g. "2026miose-pit" / "2026miose-stands"
async function loadCollection(collectionPath, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<p class="state-msg">Loading '${collectionPath}'…</p>`;

    try {
        const snap = await getDocs(collection(db, collectionPath));

        if (snap.empty) {
            container.innerHTML = `<p class="state-msg">No scouting data found in '${collectionPath}' yet.</p>`;
            return;
        }

        const data    = snap.docs.map(d => d.data());
        const columns = Object.keys(data[0]);
        const headerRow = columns.map(col => `<th>${col}</th>`).join("");

        const buildRows = (rows) => rows.map(row =>
            `<tr>${columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return `<td class="null-cell">—</td>`;
                if (typeof val === "boolean") return `<td>${val ? "✓" : "✗"}</td>`;
                return `<td>${val}</td>`;
            }).join("")}</tr>`
        ).join("");

        container.innerHTML = `
            <div class="search-bar" style="margin-top:1rem;">
                <input id="search-${containerId}" type="text" placeholder="Search…" autocomplete="off"/>
            </div>
            <div class="table-wrap">
                <table class="sn-pro">
                    <thead><tr>${headerRow}</tr></thead>
                    <tbody id="tbody-${containerId}">${buildRows(data)}</tbody>
                </table>
            </div>
        `;

        document.getElementById(`search-${containerId}`)?.addEventListener("input", (ev) => {
            const q        = ev.target.value.toLowerCase().trim();
            const filtered = q
                ? data.filter(r => columns.some(c => String(r[c]).toLowerCase().includes(q)))
                : data;
            document.getElementById(`tbody-${containerId}`).innerHTML = buildRows(filtered);
        });

    } catch (err) {
        container.innerHTML = `<p class="state-msg error">Could not load '${collectionPath}'.<br><small>${err.message}</small></p>`;
    }
}

export default async function Home() {
    setTimeout(async () => {
        const events      = await fetchEvents();
        const eventSelect = document.getElementById("event-selector");

        events.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e.key;
            opt.textContent = `${e.name} (${e.key})`;
            eventSelect.appendChild(opt);
        });

        let activeTab = "pit";

        const tabPit     = document.getElementById("tab-pit");
        const tabStands  = document.getElementById("tab-stands");
        const pitPane    = document.getElementById("pane-pit");
        const standsPane = document.getElementById("pane-stands");

        function switchTab(tab) {
            activeTab = tab;
            tabPit.classList.toggle("active",    tab === "pit");
            tabStands.classList.toggle("active", tab === "stands");
            pitPane.style.display    = tab === "pit"    ? "block" : "none";
            standsPane.style.display = tab === "stands" ? "block" : "none";
        }

        tabPit.addEventListener("click", () => {
            switchTab("pit");
            const eventId = eventSelect.value;
            if (eventId) loadCollection(`${eventId}-pit`, "pane-pit");
        });

        tabStands.addEventListener("click", () => {
            switchTab("stands");
            const eventId = eventSelect.value;
            if (eventId) loadCollection(`${eventId}-stands`, "pane-stands");
        });

        eventSelect.addEventListener("change", (e) => {
            const eventId = e.target.value;
            const tabsEl  = document.getElementById("data-tabs");

            if (!eventId) {
                tabsEl.style.display = "none";
                pitPane.innerHTML    = "";
                standsPane.innerHTML = "";
                return;
            }

            tabsEl.style.display = "flex";
            loadCollection(`${eventId}-pit`,    "pane-pit");
            loadCollection(`${eventId}-stands`, "pane-stands");
        });

    }, 0);

    return `
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Scouting Data</h1>
                <p class="page-subtitle">Select an event to view pit and stands scouting data.</p>
            </div>

            <select class="scout-select" id="event-selector" style="max-width:400px;">
                <option value="">-- Select Event --</option>
            </select>

            <div id="data-tabs" class="auth-tabs" style="display:none; max-width:300px; margin-top:1.25rem;">
                <button class="auth-tab active" id="tab-pit"    type="button">Pit</button>
                <button class="auth-tab"         id="tab-stands" type="button">Stands</button>
            </div>

            <div id="pane-pit"></div>
            <div id="pane-stands" style="display:none;"></div>
        </div>
    `;
}