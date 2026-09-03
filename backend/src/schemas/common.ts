import z from "zod";

export const uuid = (label: string) => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, `Invalid ${label} ID.`);

export const objectId = (label: string) => {
    return z.string().regex(
        /^[0-9a-fA-F]{24}$/,
        `Invalid ${label} ID.`
    );
}