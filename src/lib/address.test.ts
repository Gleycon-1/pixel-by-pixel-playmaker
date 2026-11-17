import { describe, expect, it } from "vitest";
import { addressForStorage, decodeAddressLabel, RESIDENCE_TYPES } from "./address";
import { addressSchema } from "./schemas";

const requiredAddress = {
  cep: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  city: "São Paulo",
  state: "SP",
};

describe("tipo de imóvel do endereço", () => {
  it("usa Casa quando o tipo não é informado", () => {
    expect(addressSchema.parse(requiredAddress).residence_type).toBe("casa");
  });

  it.each(RESIDENCE_TYPES)("preserva %s e o apelido sem exigir uma coluna nova", (residenceType) => {
    const stored = addressForStorage({
      ...requiredAddress,
      complement: null,
      neighborhood: null,
      reference: null,
      label: "Endereço principal",
      residence_type: residenceType,
    });

    expect(stored).not.toHaveProperty("residence_type");
    expect(decodeAddressLabel(stored.label)).toEqual({
      label: "Endereço principal",
      residence_type: residenceType,
    });
  });
});
