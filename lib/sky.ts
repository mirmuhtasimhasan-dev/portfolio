import { Color } from "three";
import { palette } from "./palette";

/**
 * The live sky colour (bg-night shifting to bg-dawn at the Contact sunrise).
 * Shared by reference: the scene background, the scene fog and the city
 * shader's fog colour all read this one object, updated each frame.
 */
export const SKY = new Color(palette.bgNight);
export const SKY_NIGHT = new Color(palette.bgNight);
export const SKY_DAWN = new Color(palette.bgDawn);
