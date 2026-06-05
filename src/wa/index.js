const sessions = new Map();

export const getSession = (userId) => sessions.get(userId);
export const setSession = (userId, sock) => sessions.set(userId, sock);
export const removeSession = (userId) => sessions.delete(userId);
export const hasSession = (userId) => sessions.has(userId);
