import { z } from "zod";


const traitSchema = z.object({
    traitType: z.string().min(1, "Trait type cannot be empty"),
    value: z.string().min(1, "Trait value cannot be empty"),
  });

export const nftCreateDTO = z.object({
    name: z.string().min(3, "Name is too short").max(50, "Name is too long"),
    description: z.string().min(3, "Description is too short").max(100, "Description is too long"),
    traits: z.array(traitSchema).optional(),
});
