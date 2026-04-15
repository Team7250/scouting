import { db } from "../firebase.js";
import {
    collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TBA_KEY = "0n75QTuNDDuPGQ42UG8GDbxmVlPGtCMnd67fSCcH04AgVMSWwgJPCdtRwjiKYO9b";
const TEAM    = "frc7250";

async function tba(endpoint) {
    const res = await fetch(`https://www.thebluealliance.com/api/v3${endpoint}`,
        { headers: { "X-TBA-Auth-Key": TBA_KEY } });
    return res.ok ? res.json() : null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function avg(arr) {
    const nums = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

function pct(arr) {
    if (!arr.length) return null;
    return (arr.filter(Boolean).length / arr.length) * 100;
}

function fmt(val, decimals = 1, suffix = "") {
    return val !== null && val !== undefined ? `${Number(val).toFixed(decimals)}${suffix}` : "—";
}

function statRow(label, value) {
    return `<tr><td>${label}</td><td class="mono">${value}</td></tr>`;
}

function playstyle(standsRows) {
    if (!standsRows.length) return { label: "Unknown", color: "var(--muted)" };
    const defPct    = pct(standsRows.map(r => r["Defended?"]));
    const avgCycles = avg(standsRows.map(r => r["Cycles Per Match"]));
    if (defPct >= 50)    return { label: "DEF",    color: "var(--blue)" };
    if (avgCycles >= 8)  return { label: "OFF",    color: "#22c55e" };
    if (defPct >= 25)    return { label: "HYBRID", color: "var(--orange)" };
    return { label: "OFF", color: "#22c55e" };
}

function reliability(standsRows) {
    if (!standsRows.length) return null;
    const brokeDown = pct(standsRows.map(r => r["Broke Down?"]));
    const climbed   = pct(standsRows.map(r => r["Climbed?"]));
    const autoOk    = pct(standsRows.map(r => r["Auto Success"]));
    return ((100 - brokeDown) * 0.5) + (climbed * 0.3) + (autoOk * 0.2);
}

// ── Firestore helpers ──────────────────────────────────────────────────────

async function getPitRows(eventKey, teamNums) {
    const snap = await getDocs(
        query(collection(db, `${eventKey}-pit`),
              where("Team Number", "in", teamNums))
    );
    return snap.docs.map(d => d.data());
}

async function getStandsRows(eventKey, teamNums) {
    const snap = await getDocs(
        query(collection(db, `${eventKey}-stands`),
              where("Team Number", "in", teamNums))
    );
    return snap.docs.map(d => d.data());
}

async function getPitRowsSingle(eventKey, teamNum) {
    const snap = await getDocs(
        query(collection(db, `${eventKey}-pit`),
              where("Team Number", "==", teamNum))
    );
    return snap.docs.map(d => d.data());
}

async function getStandsRowsSingle(eventKey, teamNum) {
    const snap = await getDocs(
        query(collection(db, `${eventKey}-stands`),
              where("Team Number", "==", teamNum))
    );
    return snap.docs.map(d => d.data());
}

// ── Modal shell ───────────────────────────────────────────────────────────

function openModal(title, htmlContent) {
    let backdrop = document.getElementById("sn-modal-backdrop");
    if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.id = "sn-modal-backdrop";
        backdrop.className = "modal-backdrop open";
        backdrop.style.zIndex = "200";
        document.body.appendChild(backdrop);
    } else {
        backdrop.classList.add("open");
    }

    backdrop.innerHTML = `
        <div class="modal" role="dialog" style="margin:auto; z-index:201;">
            <div class="modal-header">
                <span class="modal-title">${title}</span>
                <button class="modal-close" id="sn-modal-close">✕</button>
            </div>
            <div class="modal-body" id="sn-modal-body">${htmlContent}</div>
        </div>
    `;

    document.getElementById("sn-modal-close").addEventListener("click", () => backdrop.classList.remove("open"));
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.classList.remove("open"); });
}

// ── Team detail modal ─────────────────────────────────────────────────────

function buildTeamModal(team, pit, standsRows, tbaRank) {
    const avgCycles    = avg(standsRows.map(r => r["Cycles Per Match"]));
    const avgShot      = avg(standsRows.map(r => r["Shot Consistency"]));
    const climbPct     = pct(standsRows.map(r => r["Climbed?"]));
    const autoPct      = pct(standsRows.map(r => r["Auto Success"]));
    const defPct       = pct(standsRows.map(r => r["Defended?"]));
    const breakdownPct = pct(standsRows.map(r => r["Broke Down?"]));
    const reliab       = reliability(standsRows);
    const style        = playstyle(standsRows);
    const matchCount   = standsRows.length;
    const tbaRankStr   = tbaRank ? `#${tbaRank.rank}` : "—";

    const styleBadge = `<span class="result-tag" style="background:${style.color}22; color:${style.color}; font-size:0.8rem; padding:0.2rem 0.6rem;">${style.label}</span>`;

    const reliabNum   = reliab !== null ? reliab.toFixed(0) : null;
    const reliabColor = reliabNum !== null
        ? (reliabNum >= 80 ? "#22c55e" : reliabNum >= 50 ? "var(--orange)" : "var(--red)")
        : "var(--muted)";
    const reliabBar = reliabNum !== null
        ? `<div style="height:6px; border-radius:3px; background:var(--border); margin-top:4px;">
               <div style="height:6px; border-radius:3px; width:${reliabNum}%; background:${reliabColor};"></div>
           </div>
           <span class="mono" style="font-size:0.75rem; color:${reliabColor};">${reliabNum}/100</span>`
        : `<span class="mono">—</span>`;

    let html = `
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center; margin-bottom:1.25rem;">
            ${styleBadge}
            ${pit ? `<span class="mono" style="font-size:0.8rem; color:var(--foreground-2);">${pit["Drive Train"] || ""}</span>` : ""}
            ${tbaRank ? `<span class="mono" style="font-size:0.8rem; color:var(--foreground-2);">Rank ${tbaRankStr}</span>` : ""}
            <span class="mono" style="font-size:0.8rem; color:var(--muted);">${matchCount} match${matchCount !== 1 ? "es" : ""} scouted</span>
        </div>

        <div class="modal-section-label">Performance</div>
        <div class="modal-table-wrap" style="margin-bottom:1.25rem;">
            <table class="sn-pro modal-table">
                <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                <tbody>
                    ${statRow("Avg Cycles / Match",   fmt(avgCycles))}
                    ${statRow("Shot Consistency",      fmt(avgShot, 1, " / 10"))}
                    ${statRow("Climb Rate",            climbPct     !== null ? fmt(climbPct,     0, "%") : "—")}
                    ${statRow("Auto Success Rate",     autoPct      !== null ? fmt(autoPct,      0, "%") : "—")}
                    ${statRow("Defense Rate",          defPct       !== null ? fmt(defPct,       0, "%") : "—")}
                    ${statRow("Breakdown Rate",        breakdownPct !== null ? fmt(breakdownPct, 0, "%") : "—")}
                    ${statRow("Playstyle",             style.label)}
                </tbody>
            </table>
        </div>

        <div class="modal-section-label" style="margin-bottom:0.4rem;">Reliability</div>
        <div style="margin-bottom:1.25rem;">${reliabBar}</div>
    `;

    if (pit) {
        html += `
            <div class="modal-section-label">Robot Specs</div>
            <div class="modal-table-wrap" style="margin-bottom:1.25rem;">
                <table class="sn-pro modal-table">
                    <thead><tr><th>Field</th><th>Value</th></tr></thead>
                    <tbody>
                        ${statRow("Team Name",         pit["Team Name"]               || "—")}
                        ${statRow("Drive Train",        pit["Drive Train"]             || "—")}
                        ${statRow("Fire Rate",          pit["Fire Rate (Ball/Second)"] != null ? pit["Fire Rate (Ball/Second)"] + " b/s" : "—")}
                        ${statRow("Ball Capacity",      pit["Ball Capacity"]           ?? "—")}
                        ${statRow("Intake Type",        pit["Intake Type"]             || "—")}
                        ${statRow("Pick Up Method",     pit["Pick Up Method"]          || "—")}
                        ${statRow("Climb Area",         pit["Climb Area"]              || "—")}
                        ${statRow("Time to Climb",      pit["Time to Climb"]  != null ? pit["Time to Climb"] + "s" : "—")}
                        ${statRow("L1 / L2 / L3",       `${pit["L1"] ? "✓" : "✗"} / ${pit["L2"] ? "✓" : "✗"} / ${pit["L3"] ? "✓" : "✗"}`)}
                        ${statRow("Auton Climb",        pit["Auton Climb"]    ? "✓" : "✗")}
                        ${statRow("Driver Exp",         pit["Driver Exp"]     != null ? pit["Driver Exp"] + " yr" : "—")}
                        ${statRow("Pref Start Spot",    pit["Pref Start Spot"]         || "—")}
                        ${statRow("Willing to Defend",  pit["Defense?"]       ? "Yes" : "No")}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        html += `<p class="no-scout" style="margin-bottom:1rem;">No pit scouting data for Team ${team}.</p>`;
    }

    if (standsRows.length) {
        html += `
            <div class="modal-section-label">Per-Match Log</div>
            <div class="modal-table-wrap">
                <table class="sn-pro modal-table">
                    <thead><tr><th>Match</th><th>Cycles</th><th>Shot</th><th>Climb</th><th>Auto</th><th>Def</th><th>💀</th></tr></thead>
                    <tbody>
                        ${standsRows.map(r => `<tr>
                            <td class="mono">${r["Match"]           || "—"}</td>
                            <td>${r["Cycles Per Match"]             ?? "—"}</td>
                            <td>${r["Shot Consistency"]             ?? "—"}</td>
                            <td>${r["Stands Climb"]                 || "—"}</td>
                            <td>${r["Auto Success"]  ? "✓" : "✗"}</td>
                            <td>${r["Defended?"]      ? "✓" : "✗"}</td>
                            <td>${r["Broke Down?"]    ? "✓" : "✗"}</td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } else {
        html += `<p class="no-scout">No stands scouting data for Team ${team}.</p>`;
    }

    return html;
}

// ── Alliance summary modal ────────────────────────────────────────────────

function buildAllianceModal(matchData, pitByTeam, standsByTeam) {
    let html = "";

    ["red", "blue"].forEach(color => {
        const teams = matchData.alliances[color].team_keys.map(k => k.replace("frc", ""));
        const score = matchData.alliances[color].score;

        html += `
            <div class="alliance-modal-block ${color}" style="margin-bottom:1.25rem;">
                <div class="alliance-modal-header">
                    <span>${color.toUpperCase()} ALLIANCE</span>
                    <span class="alliance-modal-score">${score >= 0 ? score + " pts" : "TBD"}</span>
                </div>
        `;

        teams.forEach(team => {
            const pit        = pitByTeam[team]    || null;
            const standsRows = standsByTeam[team] || [];
            const avgCycles  = avg(standsRows.map(r => r["Cycles Per Match"]));
            const reliab     = reliability(standsRows);
            const style      = playstyle(standsRows);
            const reliabColor = reliab !== null
                ? (reliab >= 80 ? "#22c55e" : reliab >= 50 ? "var(--orange)" : "var(--red)")
                : "var(--muted)";

            html += `
                <div class="match-team-block">
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.6rem;">
                        <div class="match-team-label ${color}" style="margin:0;">Team ${team}</div>
                        <span class="result-tag" style="background:${style.color}22; color:${style.color};">${style.label}</span>
                        ${reliab !== null ? `<span class="mono" style="font-size:0.75rem; color:${reliabColor};">R:${reliab.toFixed(0)}</span>` : ""}
                    </div>
            `;

            if (pit || standsRows.length) {
                html += `
                    <div class="modal-table-wrap">
                        <table class="sn-pro modal-table">
                            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                            <tbody>
                                ${statRow("Drive Train",       pit?.["Drive Train"]        || "—")}
                                ${statRow("Ball Capacity",     pit?.["Ball Capacity"]      ?? "—")}
                                ${statRow("Intake Type",       pit?.["Intake Type"]        || "—")}
                                ${statRow("Auton Climb",       pit ? (pit["Auton Climb"] ? "✓" : "✗") : "—")}
                                ${statRow("Avg Cycles",        fmt(avgCycles))}
                                ${statRow("Climb Area",        pit?.["Climb Area"]         || "—")}
                                ${statRow("Willing to Defend", pit ? (pit["Defense?"] ? "Yes" : "No") : "—")}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                html += `<p class="no-scout">No scouting data logged.</p>`;
            }

            html += `</div>`;
        });

        html += `</div>`;
    });

    return html;
}

// ── Main export ───────────────────────────────────────────────────────────

export default async function Match() {
    setTimeout(async () => {
        try {
            const [events, statuses, districts] = await Promise.all([
                tba(`/team/${TEAM}/events/2026`),
                tba(`/team/${TEAM}/events/2026/statuses`),
                tba(`/team/${TEAM}/districts`)
            ]);

            let totalWins = 0, totalLosses = 0, totalTies = 0;
            Object.values(statuses || {}).forEach(status => {
                if (!status) return;
                if (status.qual?.ranking?.record) {
                    totalWins   += status.qual.ranking.record.wins;
                    totalLosses += status.qual.ranking.record.losses;
                    totalTies   += status.qual.ranking.record.ties;
                }
                if (status.playoff?.record) {
                    totalWins   += status.playoff.record.wins;
                    totalLosses += status.playoff.record.losses;
                    totalTies   += status.playoff.record.ties;
                }
            });

            let stateRankStr = "N/A", districtPoints = 0;
            if (districts?.length) {
                const currentDistrict = districts.find(d => d.year === 2026) || districts[0];
                const rankData = await tba(`/district/${currentDistrict.key}/rankings`);
                const teamRank = rankData?.find(r => r.team_key === TEAM);
                if (teamRank) {
                    stateRankStr   = `#${teamRank.rank} in ${currentDistrict.abbreviation.toUpperCase()}`;
                    districtPoints = teamRank.point_total;
                }
            }

            document.getElementById("team-stats").innerHTML = `
                <div class="scout-meta-bar" style="margin-bottom:2rem; grid-template-columns:repeat(3,1fr);">
                    <div class="scout-meta-field"><label class="scout-label">Overall Record</label><span class="mono">${totalWins}-${totalLosses}-${totalTies}</span></div>
                    <div class="scout-meta-field"><label class="scout-label">District Points</label><span class="mono">${districtPoints}</span></div>
                    <div class="scout-meta-field"><label class="scout-label">State Ranking</label><span class="mono">${stateRankStr}</span></div>
                </div>
            `;

            let allMatches = [];
            for (const ev of (events || [])) {
                const m = await tba(`/team/${TEAM}/event/${ev.key}/matches`);
                if (m) allMatches.push(...m.map(match => ({ ...match, _eventKey: ev.key })));
            }
            allMatches.sort((a, b) => (a.actual_time || 0) - (b.actual_time || 0));

            const renderMatches = (matches) => {
                if (!matches.length) return `<p class="state-msg">No matches found.</p>`;
                return matches.map(m => {
                    const matchLabel = m.key.split("_")[1]?.toUpperCase() ?? m.key;
                    const weAreRed   = m.alliances.red.team_keys.includes(TEAM);
                    const weAreBlue  = m.alliances.blue.team_keys.includes(TEAM);
                    const ourSide    = weAreRed ? "red" : weAreBlue ? "blue" : null;
                    let resultTag    = "";
                    if (ourSide && m.winning_alliance) {
                        if      (m.winning_alliance === ourSide) resultTag = `<span class="result-tag win">W</span>`;
                        else if (m.winning_alliance !== "")      resultTag = `<span class="result-tag loss">L</span>`;
                        else                                     resultTag = `<span class="result-tag tie">T</span>`;
                    }

                    const pillRow = (keys, color) => keys.map(k => {
                        const num = k.replace("frc", "");
                        const us  = k === TEAM;
                        return `<span class="team-pill ${color}${us ? " us" : ""}" data-team="${num}" data-event="${m._eventKey}">${num}</span>`;
                    }).join("");

                    return `
                        <div class="match-card">
                            <div class="match-card-header clickable" data-match="${m.key}" data-event="${m._eventKey}">
                                <span class="match-label">${matchLabel} · ${m._eventKey}</span>
                                ${resultTag}
                            </div>
                            <div class="match-alliances">
                                <div class="alliance-block red${m.winning_alliance === "red"  ? " won" : ""}">
                                    <div class="alliance-teams">${pillRow(m.alliances.red.team_keys,  "red")}</div>
                                    <div class="alliance-score">${m.alliances.red.score  >= 0 ? m.alliances.red.score  : "—"}</div>
                                </div>
                                <div class="alliance-block blue${m.winning_alliance === "blue" ? " won" : ""}">
                                    <div class="alliance-teams">${pillRow(m.alliances.blue.team_keys, "blue")}</div>
                                    <div class="alliance-score">${m.alliances.blue.score >= 0 ? m.alliances.blue.score : "—"}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join("");
            };

            const listContainer = document.getElementById("match-list");
            listContainer.innerHTML = renderMatches(allMatches);

            document.getElementById("match-search").addEventListener("input", (e) => {
                const q = e.target.value.toLowerCase();
                listContainer.innerHTML = renderMatches(allMatches.filter(m => m.key.toLowerCase().includes(q)));
            });

            document.body.addEventListener("click", async (e) => {
                const matchHeader = e.target.closest(".match-card-header");
                const teamPill    = e.target.closest(".team-pill");

                if (matchHeader) {
                    const matchKey  = matchHeader.dataset.match;
                    const eventKey  = matchHeader.dataset.event;
                    const matchData = allMatches.find(m => m.key === matchKey);
                    if (!matchData) return;

                    openModal(`Alliance Summary · ${matchKey}`, `<p class="state-msg">Loading scouting data…</p>`);

                    const allNums = [
                        ...matchData.alliances.red.team_keys,
                        ...matchData.alliances.blue.team_keys
                    ].map(k => Number(k.replace("frc", "")));

                    const [pitRows, standsRows] = await Promise.all([
                        getPitRows(eventKey, allNums),
                        getStandsRows(eventKey, allNums),
                    ]);

                    const pitByTeam = {}, standsByTeam = {};
                    allNums.forEach(n => {
                        const t = String(n);
                        pitByTeam[t]    = pitRows.find(r => String(r["Team Number"]) === t) || null;
                        standsByTeam[t] = standsRows.filter(r => String(r["Team Number"]) === t);
                    });

                    document.getElementById("sn-modal-body").innerHTML =
                        buildAllianceModal(matchData, pitByTeam, standsByTeam);
                }

                if (teamPill && !matchHeader) {
                    e.stopPropagation();
                    const team     = teamPill.dataset.team;
                    const eventKey = teamPill.dataset.event;

                    openModal(`Team ${team} · Summary`, `<p class="state-msg">Loading…</p>`);

                    const [pitRows, standsRows, tbaStatus] = await Promise.all([
                        getPitRowsSingle(eventKey, Number(team)),
                        getStandsRowsSingle(eventKey, Number(team)),
                        tba(`/event/${eventKey}/teams/statuses`),
                    ]);

                    const pit     = pitRows?.[0]  || null;
                    const stands  = standsRows     || [];
                    const tbaRank = tbaStatus?.[`frc${team}`]?.qual?.ranking || null;

                    document.getElementById("sn-modal-body").innerHTML =
                        buildTeamModal(team, pit, stands, tbaRank);
                }
            });

        } catch (err) {
            document.getElementById("team-stats").innerHTML =
                `<p class="state-msg error">Error: ${err.message}</p>`;
        }
    }, 0);

    return `
        <div class="page">
            <h1 class="page-title">Team 7250 · Match Reports</h1>
            <div id="team-stats"><p class="state-msg">Loading stats…</p></div>
            <div class="search-bar">
                <input id="match-search" type="text" placeholder="Search matches (e.g. qm22)…" autocomplete="off"/>
            </div>
            <div id="match-list" style="display:flex; flex-direction:column; gap:0.75rem;"></div>
        </div>
    `;
}