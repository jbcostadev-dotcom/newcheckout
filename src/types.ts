export interface CheckoutProduct {
  id: number;
  name: string;
  parent_title?: string | null;
  attributes?: { name: string; value: string }[] | null;
  description?: string | null;
  price: number;
  image_url?: string | null;
}

export interface ShippingMethod {
  id: number;
  name: string;
  price: number | null;
  min_value_free_shipping: number | null;
  min_delivery_days: number;
  max_delivery_days: number;
  icon: string | null;
}

export interface SocialProofItem {
  name: string;
  testimonial: string;
  photo_url: string | null;
  stars: number;
}

export interface OrderBumpProduct {
  id: number;
  name: string;
  parent_title?: string | null;
  attributes?: { name: string; value: string }[] | null;
  image_url?: string | null;
  original_price: number;
  bump_price: number;
}

export interface OrderBumpOffer {
  id: number;
  name: string;
  product_id: number;
  product: OrderBumpProduct;
  discount_type: "fixed" | "percent";
  discount_value: number;
  scope: "any" | "specific";
  show_credit_card: boolean;
  show_pix: boolean;
  show_boleto: boolean;
  offer_title: string;
  offer_message?: string | null;
  bg_color: string;
  border_color: string;
  button_color: string;
  button_text_color: string;
  button_label: string;
}

export interface InstallmentConfig {
  type: "default" | "custom";
  default_rate: number;
  rates: (number | null)[];
  pre_selected: number;
  limit: number;
  interest_free: number;
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
      header_logo_alignment?: string;
      header_bg_color?: string;
      header_icon_color?: string;
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
      social_proofs_enabled?: boolean;
      default_payment_method?: "credit_card" | "pix" | "boleto";
    };
    gateways: { provider: string; public_key?: string | null }[];
    payment_methods?: {
      pix: { enabled: boolean; gateway_provider?: string | null; public_key?: string | null };
      card: { enabled: boolean; gateway_provider?: string | null; public_key?: string | null; installment_config?: InstallmentConfig };
      boleto: { enabled: boolean; gateway_provider?: string | null; public_key?: string | null };
    };
  };
  products: CheckoutProduct[];
  total: number;
  shipping_methods: ShippingMethod[];
  social_proofs?: SocialProofItem[];
  order_bumps?: OrderBumpOffer[];
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
  payment_method?: string;
  gateway_transaction_id?: string | null;
  pix_qrcode?: string;
  pix_copia_cola?: string;
  boleto_url?: string | null;
  boleto_barcode?: string | null;
  boleto_digitable_line?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  installments?: number;
  gateway_expires_at?: string | null;
}

export interface PixStatusResponse {
  order_id: number;
  status: "pending" | "processing" | "waiting_payment" | "in_analysis" | "authorized" | "paid" | "failed" | "refused" | "canceled" | "refunded" | "in_protest" | "chargedback" | string;
  payment_method?: string;
  pix_qrcode?: string | null;
  pix_copia_cola?: string | null;
  boleto_url?: string | null;
  boleto_barcode?: string | null;
  boleto_digitable_line?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  installments?: number;
  total: number;
  gateway_expires_at?: string | null;
  created_at?: string | null;
  store_name?: string | null;
}