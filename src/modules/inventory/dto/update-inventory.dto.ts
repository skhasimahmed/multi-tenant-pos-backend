import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class UpdateInventoryDto {
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  quantity: number;
}
