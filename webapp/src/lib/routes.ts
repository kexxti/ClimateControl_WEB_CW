const getRouteParams = <T extends Record<string, boolean>>(object: T) => {
  return Object.keys(object).reduce((acc, key) => ({ ...acc, [key]: `:${key}` }), {}) as Record<keyof T, string>;
};

export const getDashboard = () => '/dashboard';
export const getStatistics = () => '/statistics';
export const getSettings = () => '/settings';

export const getRoomParams = getRouteParams({ roomID: true });
export type getRoomParams = typeof getRoomParams;
export const getRoom = ({ roomID }: { roomID: string }) => `/rooms/${roomID}`;

// export const getRoomParams = { roomID: ':roomID' }
// export const getRoom = ({ roomID }: { roomID: String }) => `/rooms/${roomID}`;
