export async function loadRigConfig(path = './rig_config.json') {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load rig config (${res.status})`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('[BASE] Unable to load rig_config.json:', err);
    return null;
  }
}

