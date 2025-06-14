// leads.js – Clean Rebuild with Presentation Mode, Daily List, and All Filters
console.log("✅ Loaded leads_merged_with_proxy_fix.js");
map = L.map('map').setView([37.8, -96], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
let markerCluster = L.markerClusterGroup();
let allData = [];
let markers = [];
let usingClusters = true;
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
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  data.forEach((row, index) => {
    const lat = parseFloat(row['Latitude']);
    const lon = parseFloat(row['Longitude']);
    if (!isNaN(lat) && !isNaN(lon)) {
      const color = statusColors[row['Status']] || 'grey';
      const marker = L.marker([lat, lon], { icon: getIcon(color) });

      marker.bindPopup(createEditablePopup(row, marker, index));
      markers.push(marker);

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




function createEditablePopup(row, marker, index) {
  const previewDiv = document.createElement('div');
  previewDiv.style.width = "420px";
  previewDiv.style.fontFamily = "Arial, sans-serif";

  const company = row['Company'] || '[No Company]';
  const contact = row['Name'] || '';
  const type = row['Type'] || '';
  const city = row['City'] || '';
  const state = row['State'] || '';
  const notes = row['Notes'] || '';
  const website = row['Website'] || '';
  const arr = row['ARR'] || '';

  previewDiv.innerHTML = `
    <strong>${company}</strong><br>
    ${contact ? '<span style="color:#007bff;">' + contact + '</span><br>' : ''}
    <span>${city}, ${state}</span><br>
    Tag: ${row['Tags'] || '—'}<br>Size: ${row['Size'] || '—'}<br>Type: ${type}<br>
    ARR: ${arr}<br>
    Notes: <em>${notes}</em><br>
    <a href="${website}" target="_blank">Visit Website</a><br><br>
  `;

  const editBtn = document.createElement('button');
  editBtn.textContent = "✏️ Edit";
  editBtn.style = "padding: 6px 12px; background-color: #444; color: white; border: none; border-radius: 6px; cursor: pointer;";
  editBtn.addEventListener('click', () => {
    const container = document.createElement('div');
    container.style.width = "420px";
    container.style.padding = "10px";
    container.style.fontFamily = "Arial, sans-serif";

    function addDropdown(labelText, id, selectedValue, options) {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.cssText = "display:block; font-weight:bold; margin-top:10px; margin-bottom:4px;";
      const select = document.createElement('select');
      select.id = id;
      select.style.cssText = "width: 65%; padding: 5px; font-size: 14px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px;";
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === selectedValue) o.selected = true;
        select.appendChild(o);
      });
      container.appendChild(label);
      container.appendChild(select);
    }

    function addTextField(labelText, id, value, isTextArea = false) {
      const label = document.createElement('label');
      label.textContent = labelText;
      label.style.cssText = "display:block; font-weight:bold; margin-top:10px; margin-bottom:4px;";
      container.appendChild(label);
      let input;
      if (isTextArea) {
        input = document.createElement('textarea');
        input.rows = 4;
      } else {
        input = document.createElement('input');
      }
      input.id = id;
      input.value = value;
      input.style.cssText = "width: 65%; padding: 5px; font-size: 14px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px;";
      container.appendChild(input);
    }

    addDropdown('Tag:', 'editTag', row['Tags'] || '', ['Automation','Top Target','Follow-Up','Cold','Watch','Referral']);
    addDropdown('Type:', 'editType', row['Type'] || '', ['PMC','HOA','Vendor','Board','Developer']);
    addDropdown('Status:', 'editStatus', row['Status'] || '', ['Hot','Warm','Cold','Follow-Up','Converted','Research','Unspecified']);
    addTextField('Notes:', 'editNotes', row['Notes'] || '', true);
    addTextField('Website:', 'editWebsite', row['Website'] || '');
    addDropdown('Net New:', 'editNetNew', row['Net New'] || '', ['Yes','No','Unknown']);
    addDropdown('Size:', 'editSize', row['Size'] || '', ['Small','Medium','Large']);
    addTextField('ARR:', 'editARR', row['ARR'] || '');
    addDropdown('Obstacle:', 'editObstacle', row['Obstacle'] || '', ['None','Price','Timing','Competitor','Not Interested']);
    addDropdown('Self Sourced:', 'editSelfSourced', row['Self Sourced'] || '', ['Yes','No']);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = "Save";
    saveBtn.style = "padding: 8px 16px; background-color: #444; color: white; border: none; border-radius: 6px; cursor: pointer;";
    saveBtn.addEventListener('click', () => submitEdits(index, saveBtn));
    container.appendChild(saveBtn);

    marker.setPopupContent(container);
  });

  previewDiv.appendChild(editBtn);
  return previewDiv;
}



function submitEdits(index, buttonEl) {
  const marker = markers[index];
  const popup = buttonEl.closest('div');
  const row = allData[index];
  row['Type'] = popup.querySelector('#editType').value;
  row['Status'] = popup.querySelector('#editStatus').value;
  row['Notes'] = popup.querySelector('#editNotes').value;
  row['Website'] = popup.querySelector('#editWebsite').value;
  row['Net New'] = popup.querySelector('#editNetNew').value;
  row['Size'] = popup.querySelector('#editSize').value;
  row['ARR'] = popup.querySelector('#editARR').value;
  row['Obstacle'] = popup.querySelector('#editObstacle').value;
  row['Self Sourced'] = popup.querySelector('#editSelfSourced').value;
  row['ID'] = `${row['Company']}|${row['City']}|${row['State']}`;  // Composite ID for precise row matching
  row['ID'] = row['Company'];  // Add pseudo-ID based on Company name
  popup.style.width = '';
  popup.style.height = '';
  submitLeadToSheet(row);
  alert('✅ Changes saved successfully!');
  if (marker) marker.closePopup();
  applyFilters();
}