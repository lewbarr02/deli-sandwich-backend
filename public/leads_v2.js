// leads_v2.js – Clean Rebuild with Presentation Mode, Daily List, and All Filters
console.log("✅ Loaded leads_merged_with_proxy_fix.js");
map = L.map('map').setView([37.8, -96], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
let markerCluster = L.markerClusterGroup();
let allData = [];
let markerMap = {};
let usingClusters = true;  // ✅ Fix: declare for cluster toggle
const statusColors = {
  Hot: 'red',
  Warm: 'orange',
  Cold: 'blue',
  'Follow-Up': 'yellow',
  Converted: 'green',
  Research: 'black',
  Unspecified: 'grey'
};

function getIcon(color) {
  return L.icon({
    iconUrl: `images/marker-icon-${color}.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'images/marker-shadow.png',
    shadowSize: [41, 41]
  });
}

function submitLeadToSheet(leadData) {
  console.log("🛰️ PROXY VERSION ACTIVE – sending to backend:", leadData);
  fetch("http://localhost:3000/my-summary/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(leadData)
  })
  .then(response => response.text())
  .then(result => console.log("✅ Submitted via proxy:", result))
  .catch(error => console.error("❌ Proxy submission error:", error));
}



function addMarkers(data) {
  markerCluster.clearLayers();
  Object.values(markerMap).forEach(marker => map.removeLayer(marker));
  markerMap = {};

  data.forEach((row, index) => {
    const lat = parseFloat(row['Latitude']);
    const lon = parseFloat(row['Longitude']);
    if (!isNaN(lat) && !isNaN(lon)) {
      const color = statusColors[row['Status']] || 'grey';
      const marker = L.marker([lat, lon], { icon: getIcon(color) });
      marker.leadId = row.id || index;
      marker.leadId = row.id || index;

      marker.leadIndex = index;
    marker.on('click', () => {
      marker.bindPopup(createPreviewPopup(row, index)).openPopup();
    });
      markerMap[index] = marker;

      if (usingClusters) {
        markerCluster.addLayer(marker);
      } else {
        marker.addTo(map);
      }
    }
  });

  if (usingClusters) {
    map.addLayer(markerCluster);
  }
}


function applyFilters() {
  const tag = document.getElementById('tagFilter').value;
  const type = document.getElementById('typeFilter').value;
  const cadence = document.getElementById('cadenceFilter').value;
  const state = document.getElementById('stateFilter').value;
  const checkedStatuses = Array.from(document.querySelectorAll('.status-checkbox input:checked')).map(cb => cb.value);
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const filtered = allData.filter(row => {
    if (tag !== 'All' && row['Tags'] !== tag) return false;
    if (type !== 'All' && row['Type'] !== type) return false;
    if (cadence !== 'All' && row['Cadence Name'] !== cadence) return false;
    if (state !== 'All' && row['State'] !== state) return false;
    const status = (row['Status'] || 'Unspecified').trim();
    if (!checkedStatuses.includes(status)) return false;
    if (startDate && row['Date'] && row['Date'] < startDate) return false;
    if (endDate && row['Date'] && row['Date'] > endDate) return false;
    return true;
  });
  addMarkers(filtered);
  updateDropdowns(filtered);
  updateStats(filtered);
}

function updateDropdowns(data) {
  const tagSet = new Set();
  const typeSet = new Set();
  const cadenceSet = new Set();
  const stateSet = new Set();
  data.forEach((row, i) => {
    if (row['Tags']) tagSet.add(row['Tags']);
    if (row['Type']) typeSet.add(row['Type']);
    if (row['Cadence Name']) cadenceSet.add(row['Cadence Name']);
    if (row['State']) stateSet.add(row['State']);
  });
  populateDropdown('tagFilter', tagSet);
  populateDropdown('typeFilter', typeSet);
  populateDropdown('cadenceFilter', cadenceSet);
  populateDropdown('stateFilter', stateSet);
}

function populateDropdown(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="All">All</option>';
  Array.from(values).sort().forEach(val => {
    const option = document.createElement('option');
    option.value = val;
    option.textContent = val;
    select.appendChild(option);
  });
  select.value = selected;
}

function updateStats(filteredLeads) {
  const statusCounts = {};
  let summaryHtml = '';
  let total = 0;
  filteredLeads.forEach(row => {
    const status = (row['Status'] || 'Unspecified').trim();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    total++;
  });
  for (const status in statusCounts) {
    summaryHtml += `${status}: ${statusCounts[status]}<br>`;
  }
  document.getElementById('statsSummary').innerHTML = summaryHtml;
  document.getElementById('pinCount').textContent = `Displaying ${filteredLeads.length} of ${total} leads`;
}

document.getElementById('resetFilters').addEventListener('click', () => {
  document.getElementById('tagFilter').value = 'All';
  document.getElementById('typeFilter').value = 'All';
  document.getElementById('cadenceFilter').value = 'All';
  document.getElementById('stateFilter').value = 'All';
  document.getElementById('clusterToggle').checked = true;
  usingClusters = true;
  document.querySelectorAll('.status-checkbox input').forEach(cb => cb.checked = true);
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  applyFilters();
});

document.getElementById('clusterToggle').addEventListener('change', (e) => {
  usingClusters = e.target.checked;
  applyFilters();
});

['tagFilter', 'typeFilter', 'cadenceFilter', 'stateFilter', 'startDate', 'endDate'].forEach(id => {
  document.getElementById(id).addEventListener('change', applyFilters);
});

document.querySelectorAll('.status-checkbox input').forEach(cb => cb.addEventListener('change', applyFilters));

function loadData() {
  Papa.parse("https://docs.google.com/spreadsheets/d/e/2PACX-1vS4uHn7Q6v_fG_H4vTsbeMmxkATNsOsPnRnx2vHYl57yVDTHLclNXDSyNy4EIY06dEjtl43teTyxIhW/pub?output=csv", {
    download: true,
    header: true,
    complete: function(results) {
      allData = results.data;
      applyFilters();
    }
  });
}





loadData();


document.getElementById('launchPresentation').addEventListener('click', () => openPresentationMode());

document.getElementById('exportDailyList').addEventListener('click', () => {
  const hotLeads = allData.filter(r => (r['Status'] || '').trim() === 'Hot');
  const warmLeads = allData.filter(r => (r['Status'] || '').trim() === 'Warm');
  const unspecified = allData.filter(r => {
    const s = (r['Status'] || '').trim();
    return !['Hot','Warm','Cold','Follow-Up','Converted','Research'].includes(s);
  }).sort(() => 0.5 - Math.random()).slice(0, 40);

  function section(title, icon, leads) {
    let rows = `<h2>${icon} ${title}</h2>`;
    rows += '<table cellspacing="0" cellpadding="5" style="width:100%; border-collapse:collapse;">';
    rows += '<tr><th style="border: 1px solid #000;">Company</th><th style="border: none;"></th></tr>';
    leads.forEach(l => {
      rows += `<tr><td style="border: 1px solid #000;">${company}</td><td style="border: none;"></td></tr>`;
    });
    rows += '</table><br>';
    return rows;
  }

  const html = `
    <html><head><meta charset='utf-8'><style>
    body { font-family: 'Nunito Sans', sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; font-size: 14px; }
    </style></head><body>
    <h1>🧭 Daily Lead List</h1>
    <p>Auto-generated on: ${new Date().toLocaleDateString()}</p>
    ${section('Hot Leads','🔴',hotLeads)}
    ${section('Warm Leads','🟠',warmLeads)}
    ${section('40 Random Unspecified Leads','⚪',unspecified)}
    </body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "DeliSandwich_Daily_Lead_List.doc";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});


function openPresentationMode() {
  const tag = document.getElementById('tagFilter').value;
  const type = document.getElementById('typeFilter').value;
  const cadence = document.getElementById('cadenceFilter').value;
  const state = document.getElementById('stateFilter').value;
  const checkedStatuses = Array.from(document.querySelectorAll('.status-checkbox input:checked')).map(cb => cb.value);
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const matched = allData.filter(row => {
    if (tag !== 'All' && row['Tags'] !== tag) return false;
    if (type !== 'All' && row['Type'] !== type) return false;
    if (cadence !== 'All' && row['Cadence Name'] !== cadence) return false;
    if (state !== 'All' && row['State'] !== state) return false;
    const status = (row['Status'] || 'Unspecified').trim();
    if (!checkedStatuses.includes(status)) return false;
    const rawDate = row['Date']?.trim();
    if (start && rawDate && rawDate < start) return false;
    if (end && rawDate && rawDate > end) return false;
    return true;
  });
  const display = document.getElementById('presentationDisplay');
  let html = `
    <div style="text-align:right;">
      <button id="closePresentationButton" style="font-size:16px; border:none; background:none; cursor:pointer;">❌</button>
      <button onclick="exportPresentationToWord()" style="font-size:14px; margin-right:10px;">📤 Export</button>
      <button onclick="downloadPDFExport()" style="font-size:14px;">📄 PDF Export</button>
    </div>
`;
  const options = { month: 'short', day: 'numeric' };
  const formattedStart = start ? new Date(start).toLocaleDateString('en-US', options) : null;
  const formattedEnd = end ? new Date(end).toLocaleDateString('en-US', options) : null;
  if (formattedStart && formattedEnd) {
    html += `<h2 style="margin-top:0; font-weight:600;">Date Range: ${formattedStart} – ${formattedEnd}</h2>`;
  } else if (formattedStart) {
    html += `<h2 style="margin-top:0; font-weight:600;">Since ${formattedStart}</h2>`;
  } else if (formattedEnd) {
    html += `<h2 style="margin-top:0; font-weight:600;">Up to ${formattedEnd}</h2>`;
  }

  const grouped = { Converted: [], Hot: [], Warm: [], Cold: [] };
  matched.forEach(row => {
    const status = (row['Status'] || '').trim();
    if (status === 'Converted') grouped.Converted.push(row);
    else if (status === 'Hot') grouped.Hot.push(row);
    else if (status === 'Warm') grouped.Warm.push(row);
    else if (status === 'Cold') grouped.Cold.push(row);
  });

  function block(title, icon, list) {
    html += `<h2 style="margin-top:20px;">${icon} ${title} (${list.length})</h2><hr style="margin-bottom:10px;">`;
    if (list.length === 0) {
      html += `<div style="margin-bottom:10px; font-style:italic;">No entries.</div>`;
    } else {
      list.forEach(row => {
        const emojiMap = {
          'Hot': '🔥',
          'Warm': '🌞',
          'Cold': '🧊',
          'Follow-Up': '⏳',
          'Converted': '🏆',
          'Research': '🔍',
          'Unspecified': '⚪'
        };
        const isExporting = document.getElementById('presentationDisplay')?.getAttribute('data-exporting') === 'true';
        const pinIcon = isExporting
          ? (emojiMap[row['Status']?.trim()] || "⚪")
          : `<img src="images/marker-icon-${statusColors[row['Status']?.trim()]}.png" width="14" style="vertical-align:middle" />`;

        const companyName = row['Company'] || '[No Company]';
        const type = row['Type']?.trim();
        const contact = row['Name']?.trim();
        const city = row['City'] || '';
        const state = row['State'] || '';
        const notes = row['Notes'] || 'No notes added';

        
        html += `<div style="margin-bottom:12px;">
          ${pinIcon} <strong>${companyName}${(type ? ' (' + type + ')' : '')}</strong><br>
          <span style="font-size: 13px; color: #555;">${city}, ${state}</span><br>
          ${contact ? '<span style="font-size: 12px; color: #007bff;">(' + contact + ')</span><br>' : ''}
          <span style="font-style: italic; font-size: 12px; color: #333;">${notes}</span>
        </div>`;
      }); // ✅ Close forEach
    } // ✅ Close if/else
  } // ✅ Close block()

  block("Converted Leads", "🏆", grouped.Converted);
  block("Hot Leads", "🔥", grouped.Hot);
  block("Warm Leads", "🌞", grouped.Warm);
  block("Cold Leads", "🧊", grouped.Cold);

  display.innerHTML = html;
  display.style.display = 'block';
} // ✅ Close openPresentationMode()


function closePresentationMode() {
  const display = document.getElementById('presentationDisplay');
  display.innerHTML = '';
  display.style.display = 'none';
}


// Use event delegation to handle close button in dynamically inserted Presentation Mode
document.getElementById('presentationDisplay')?.addEventListener('click', function (e) {
  if (e.target && e.target.matches('#closePresentationButton')) {
    closePresentationMode();
  }
});






function createEditablePopup(lead) {
  const popup = document.createElement('div');
  popup.className = 'editable-popup';

  const leadId = lead.id || lead.leadIndex;

  popup.innerHTML = `
    <strong>${lead.company}</strong><br><br>

    <label>Tag:</label>
    <select id="tag-${leadId}">
      <option value="Appfolio" ${lead.tags === 'Appfolio' ? 'selected' : ''}>Appfolio</option>
      <option value="Building Link" ${lead.tags === 'Building Link' ? 'selected' : ''}>Building Link</option>
      <option value="Buildium" ${lead.tags === 'Buildium' ? 'selected' : ''}>Buildium</option>
      <option value="Caliber" ${lead.tags === 'Caliber' ? 'selected' : ''}>Caliber</option>
      <option value="FronstSteps" ${lead.tags === 'FronstSteps' ? 'selected' : ''}>FronstSteps</option>
      <option value="PMC Managed" ${lead.tags === 'PMC Managed' ? 'selected' : ''}>PMC Managed</option>
      <option value="QuickBooks" ${lead.tags === 'QuickBooks' ? 'selected' : ''}>QuickBooks</option>
      <option value="Rent Cafe" ${lead.tags === 'Rent Cafe' ? 'selected' : ''}>Rent Cafe</option>
      <option value="Rent Manager" ${lead.tags === 'Rent Manager' ? 'selected' : ''}>Rent Manager</option>
      <option value="Other" ${lead.tags === 'Other' ? 'selected' : ''}>Other</option>
      <option value="VMS" ${lead.tags === 'VMS' ? 'selected' : ''}>VMS</option>
      <option value="Vantaca" ${lead.tags === 'Vantaca' ? 'selected' : ''}>Vantaca</option>
    </select><br>

    <label>Type:</label>
    <select id="type-${leadId}">
      <option value="PMC" ${lead.type === 'PMC' ? 'selected' : ''}>PMC</option>
      <option value="SMA" ${lead.type === 'SMA' ? 'selected' : ''}>SMA</option>
      <option value="Other" ${lead.type === 'Other' ? 'selected' : ''}>Other</option>
    </select><br>

    <label>Status:</label>
    <select id="status-${leadId}">
      <option value="Converted" ${lead.status === 'Converted' ? 'selected' : ''}>Converted</option>
      <option value="Hot" ${lead.status === 'Hot' ? 'selected' : ''}>Hot</option>
      <option value="Warm" ${lead.status === 'Warm' ? 'selected' : ''}>Warm</option>
      <option value="Follow-Up" ${lead.status === 'Follow-Up' ? 'selected' : ''}>Follow-Up</option>
      <option value="Cold" ${lead.status === 'Cold' ? 'selected' : ''}>Cold</option>
      <option value="Research" ${lead.status === 'Research' ? 'selected' : ''}>Research</option>
      <option value="Unspecified" ${lead.status === 'Unspecified' ? 'selected' : ''}>Unspecified</option>
    </select><br>

    <label>Notes:</label>
    <textarea id="notes-${leadId}">${lead.notes || ''}</textarea><br>

    <label>Website:</label>
    <input type="text" id="website-${leadId}" value="${lead.website || ''}"><br>

    <label>Net New:</label>
    <select id="netnew-${leadId}">
      <option value="Yes" ${lead.net_new === 'Yes' ? 'selected' : ''}>Yes</option>
      <option value="No" ${lead.net_new === 'No' ? 'selected' : ''}>No</option>
    </select><br>

    <label>Size:</label>
    <input type="text" id="size-${leadId}" value="${lead.size || ''}"><br>

    <label>ARR:</label>
    <input type="number" id="arr-${leadId}" value="${lead.arr || ''}"><br>

    <label>Obstacle:</label>
    <input type="text" id="obstacle-${leadId}" value="${lead.obstacle || ''}"><br>

    <label>Self Sourced:</label>
    <select id="selfsourced-${leadId}">
      <option value="Yes" ${lead.self_sourced === 'Yes' ? 'selected' : ''}>Yes</option>
      <option value="No" ${lead.self_sourced === 'No' ? 'selected' : ''}>No</option>
    </select><br>

    <button onclick="submitEdits(${leadId})">Save</button>
  `;

  return popup;
}

async function submitEdits(id) {
  console.log("🧠 Incoming ID:", id);

  const status = document.getElementById(`status-${id}`)?.value || "";
  const saveButton = event?.target;
  if (!status.trim()) {
    alert("⚠️ Status is required.");
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }

  const updatedData = {
    id: id,
    tags: document.getElementById(`tag-${id}`)?.value || "",
    type: document.getElementById(`type-${id}`)?.value || "",
    status: status,
    notes: document.getElementById(`notes-${id}`)?.value || "",
    website: document.getElementById(`website-${id}`)?.value || "",
    net_new: document.getElementById(`netnew-${id}`)?.value || "",
    size: document.getElementById(`size-${id}`)?.value || "",
    arr: parseFloat(document.getElementById(`arr-${id}`)?.value || 0),
    obstacle: document.getElementById(`obstacle-${id}`)?.value || "",
    self_sourced: document.getElementById(`selfsourced-${id}`)?.value || ""
  };

  console.log("📤 Normalized payload for backend:", updatedData);

  try {
    const response = await fetch('/update-lead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });

    if (response.ok) {
      console.log("✅ Lead updated successfully");

      // 🔁 Update local memory
      const targetIndex = allData.findIndex(row => (row.id || row.leadIndex) == id);
      if (targetIndex !== -1) {
        allData[targetIndex] = { ...allData[targetIndex], ...updatedData };
      }

      alert('✅ Lead saved!');
      closeAllPopups();
      applyFilters();  // 🔁 Refresh with new values
    } else {
      alert('❌ Failed to update lead. Backend returned: ' + response.status);
    }
  } catch (err) {
    console.error("❌ Network error during save:", err);
    alert('Error connecting to backend.');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Save";
    }
  }
}




function createPreviewPopup(lead, index) {
  const container = document.createElement('div');
  container.innerHTML = `
    <strong>${lead['Company']}</strong><br>
    <em>${lead['City']}, ${lead['State']}</em><br><br>
    <b>Tag:</b> ${lead['Tags'] || ''}<br>
    <b>Type:</b> ${lead['Type'] || ''}<br>
    <b>Status:</b> ${lead['Status'] || ''}<br>
    <b>Notes:</b> ${lead['Notes'] || ''}<br>
    <b>Website:</b> ${lead['Website'] || ''}<br>
    <b>Net New:</b> ${lead['Net New'] || ''}<br>
    <b>Size:</b> ${lead['Size'] || ''}<br>
    <b>ARR:</b> ${lead['ARR'] || ''}<br>
    <b>Obstacle:</b> ${lead['Obstacle'] || ''}<br>
    <b>Self Sourced:</b> ${lead['Self Sourced'] || ''}<br><br>
    <button class="edit-button" data-lead-index="${index}">✏️ Edit</button>
  `;
  return container;
}


  



function switchToEdit(index) {
  console.log("🛠️ Edit triggered for index:", index);
  const idx = parseInt(index);
  const row = allData[idx];
  const marker = markerMap[idx];

  if (!row || !marker) {
    console.warn("❌ Lead row or marker not found for index:", idx);
    return;
  }

  console.log("✅ Found marker and row, injecting editable popup...");
  row.leadIndex = idx;
  marker.setPopupContent(createEditablePopup(row));
  marker.openPopup();
}


// 🔁 Delegated listener for edit buttons in Leaflet popups
document.addEventListener("click", function (e) {
  if (e.target && e.target.classList.contains("edit-button")) {
    const index = e.target.getAttribute("data-lead-index");
    switchToEdit(index);
  }
});

function closeAllPopups() {
  map.closePopup();
}
