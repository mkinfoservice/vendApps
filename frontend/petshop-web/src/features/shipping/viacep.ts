export type ViaCepResponse = {
    cep: string;
    logradouro: string; 
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    ibge?: string;
    gia?: string;
    ddd?: string;
    siafi?: string;
    erro?: boolean;
};

export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse> {
    const onlyDigits = cep.replace(/\D/g, "");
    if (onlyDigits.length !== 8) {
        throw new Error("CEP Inválido. Use 8 dígitos.");
    }

    const r = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`, {
        headers: { Accept: "application/json" },
    });

    if (!r.ok) throw new Error("Não foi possível consultar o CEP.");

    const data = (await r.json()) as ViaCepResponse;
    if (data.erro) throw new Error("CEP não encontrado.");

    return data;
}