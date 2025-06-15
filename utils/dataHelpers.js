// utils/dataHelpers.js

async function getFilteredLeads(from, to) {
  // Fake leads for testing
  return [
    { name: "Jane Doe", company: "Sunny HOA Mgmt", status: "Hot", state: "FL", notes: "Waiting for board approval" },
    { name: "Mike Smith", company: "Greenway PM", status: "Warm", state: "TX", notes: "Follow up June 2" },
    { name: "Carla Ruiz", company: "OceanView HOA", status: "Hot", state: "FL", notes: "Referred by client" }
  ];
}

async function generateAISummary(leads) {
  return `You contacted ${leads.length} leads. ${leads.filter(l => l.status === "Hot").length} are marked Hot.`;
}

module.exports = { getFilteredLeads, generateAISummary };
