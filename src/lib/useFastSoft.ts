"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Tipos do SDK FastSoft carregado em window.FastSoft.
 * Documentação: https://developers.fastsoftbrasil.com/en/docs/intro/card-tokenization
 */
export interface FastSoftCardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface FastSoftThreeDSInitData {
  amount: number; // em centavos
  currency: string;
  installments: number;
  card: {
    number: string;
    holderName: string;
    expMonth: string;
    expYear: string;
  };
}

export interface FastSoftThreeDSAuthData {
  customer: {
    name: string;
    email: string;
    phoneNumber: string;
  };
  address: {
    street: string;
    streetNumber: string;
    complement: string;
    zipCode: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
  };
}

export type ThreeDSResultType =
  | "success"
  | "failure"
  | "unenrolled"
  | "error"
  | "unsupportedBrand"
  | "disabled";

export interface ThreeDSResult {
  type: ThreeDSResultType;
  [key: string]: unknown;
}

interface FastSoftSDK {
  setPublicKey(key: string): Promise<void>;
  getApiUrl(): string;
  isThreeDSEnabled(): boolean;
  initializeThreeDS(data: FastSoftThreeDSInitData): Promise<void>;
  authenticateThreeDS(data: FastSoftThreeDSAuthData): Promise<ThreeDSResult>;
  finalizeThreeDS(): Promise<void>;
  encrypt(cardData: FastSoftCardData): Promise<string>;
}

declare global {
  interface Window {
    FastSoft?: FastSoftSDK;
  }
}

export interface UseFastSoftResult {
  ready: boolean;
  error: string | null;
  encrypt: ((card: FastSoftCardData) => Promise<string>) | null;
  /**
   * Tokeniza um cartão aplicando o fluxo 3DS automaticamente quando disponível.
   * Retorna o token string (já com dados 3DS embutidos se 3DS aplicou).
   */
  tokenizeWith3DS: ((
    card: FastSoftCardData,
    threeDS: {
      transaction: Omit<FastSoftThreeDSInitData, "card">;
      auth: FastSoftThreeDSAuthData;
    }
  ) => Promise<string>) | null;
}

const loadedScript = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const existing = loadedScript.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("document indisponível"));
      return;
    }

    const existingTag = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existingTag) {
      if (window.FastSoft) {
        resolve();
        return;
      }
      existingTag.addEventListener("load", () => resolve(), { once: true });
      existingTag.addEventListener("error", () => reject(new Error("Falha ao carregar SDK FastSoft")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar SDK FastSoft"));
    document.head.appendChild(script);
  });

  loadedScript.set(src, promise);
  return promise;
}

/**
 * Carrega o SDK FastSoft security.js e inicializa com a chave pública.
 * A chave pública (pk_live_*) vem do backend (gateways unipay), não do env.
 */
export function useFastSoft(publicKey: string | null | undefined): UseFastSoftResult {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jsUrl =
    process.env.NEXT_PUBLIC_UNIPAY_JS_URL ||
    "https://js.fastsoftbrasil.com/security.js";

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    if (!publicKey) {
      setError("Chave pública da Unipay não disponível para esta loja.");
      return;
    }

    loadScriptOnce(jsUrl)
      .then(async () => {
        if (cancelled) return;
        const sdk = window.FastSoft;
        if (!sdk) {
          throw new Error("SDK FastSoft não encontrado após carregar o script.");
        }
        await sdk.setPublicKey(publicKey);
        if (cancelled) return;
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro ao inicializar SDK FastSoft.");
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, jsUrl]);

  const encrypt = useCallback(
    async (card: FastSoftCardData): Promise<string> => {
      const sdk = window.FastSoft;
      if (!sdk) throw new Error("SDK FastSoft não carregado.");
      return sdk.encrypt(card);
    },
    []
  );

  const tokenizeWith3DS = useCallback(
    async (
      card: FastSoftCardData,
      threeDS: {
        transaction: Omit<FastSoftThreeDSInitData, "card">;
        auth: FastSoftThreeDSAuthData;
      }
    ): Promise<string> => {
      const sdk = window.FastSoft;
      if (!sdk) throw new Error("SDK FastSoft não carregado.");

      // 1. Verifica necessidade de 3DS.
      const enabled = sdk.isThreeDSEnabled();
      if (!enabled) {
        // Tokeniza direto, sem dados 3DS.
        return sdk.encrypt(card);
      }

      // 2. Inicializa 3DS com dados da transação e do cartão.
      await sdk.initializeThreeDS({
        ...threeDS.transaction,
        card: {
          number: card.number,
          holderName: card.holderName,
          expMonth: card.expMonth,
          expYear: card.expYear,
        },
      });

      // 3. Autentica com dados do cliente e endereço. Em caso de failure,
      // continuamos o fluxo (o gateway decidirá aceitar/recusar).
      let result: ThreeDSResult;
      try {
        result = await sdk.authenticateThreeDS(threeDS.auth);
      } catch (err) {
        // Falha tácnica na autenticação: tentamos finalizar e seguir sem 3DS.
        result = { type: "error" };
      }

      if (result.type === "error") {
        // Uma tentativa de retry (já dentro do fluxo) — aqui seguimos direto,
        // pois o gateway processa mesmo sem 3DS.
      }

      // 4. Finaliza o processo 3DS.
      try {
        await sdk.finalizeThreeDS();
      } catch {
        // Mesmo falhando em finalizar, tentamos tokenizar.
      }

      // 5. Tokeniza o cartão (dados 3DS embutidos automaticamente).
      return sdk.encrypt(card);
    },
    []
  );

  return {
    ready,
    error,
    encrypt: ready ? encrypt : null,
    tokenizeWith3DS: ready ? tokenizeWith3DS : null,
  };
}