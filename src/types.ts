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
      banner_height?: string;
      button_text?: string;
      banner_message?: string;
      enable_order_bump: boolean;
      header_store_name_visible?: boolean;
      header_secure_badge?: boolean;
      announcement_bar_enabled?: boolean;
      announcement_bar_bg?: string;
      announcement_bar_text_color?: string;
      summary_title?: string;
      summary_show_discount?: boolean;
      summary_coupon_enabled?: boolean;
      step_title_font_size?: string;
      scarcity_enabled?: boolean;
      scarcity_type?: string;
      scarcity_text?: string | null;
      scarcity_countdown_minutes?: number;
      pix_confirmation_title?: string;
      pix_confirmation_message?: string | null;
      pix_confirmation_logo?: string | null;
      footer_text?: string;
      footer_show_cnpj?: boolean;
      footer_cnpj?: string | null;
      font_family?: string;
      font_size_base?: string;
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