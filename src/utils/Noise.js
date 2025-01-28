import { MathUtils } from "three";

export function permute(x) {
    return MathUtils.euclideanModulo(x * 34.0 + 1.0, 289.0);
}

export function permute3(x, y, z) {
    return permute(x + permute(y + permute(z)));
}

export function noise3(x, y, z) {
    return permute3(x, y, z) / 289.0;
}