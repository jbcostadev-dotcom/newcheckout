export interface CheckoutProduct {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
}

export interface CheckoutData {
  store: {
    name: string;
    settings: {
      primary_color: string;
      secondary_color: string;
      dark_mode: boolean;
      logo_url: string | null;
      banner_url: string | null;
      button_text?: string;
      banner_message?: string;
      enable_order_bump: boolean;
    };
    gateways: { provider: string }[];
  };
  products: CheckoutProduct[];
  total: number;
  preview?: boolean;
}

export interface ShippingAddress {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface CardData {
  number: string;
  expiry: string;
  cvv: string;
  holder: string;
  holder_document: string;
  installments: number;
}

export interface CheckoutProcessResponse {
  order_id?: number;
  status?: string;
  message?: string;
  pix_qrcode?: string;
  pix_copia_cola?: string;
}