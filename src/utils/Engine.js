// Groups for collision filtering, uses bitwise operators
// To add a new one take the nth free group by adding "NEW_GROUP = 1 << n", with n > 0
export const GROUP_PLANT = 1 << 0;
export const GROUP_GROUND = 1 << 1; 