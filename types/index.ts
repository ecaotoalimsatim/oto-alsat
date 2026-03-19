export type VehicleStatus = 'in_stock' | 'for_sale' | 'sold' | 'in_repair'

export interface Car {
  id: string
  user_id: string
  model: string
  buy_price: number
  cost: number
  sell_price: number
  profit?: number
  status: VehicleStatus
  created_at: string
}

export type CustomerStatus = 'ilgileniyor' | 'teklif_verildi' | 'pazarlık' | 'satın_aldı' | 'vazgeçti'

export interface Customer {
  id: string
  user_id: string
  name: string
  phone: string
  car_id: string | null
  offer: number | null
  interest: string
  notes: string
  status: CustomerStatus
  created_at: string
}
