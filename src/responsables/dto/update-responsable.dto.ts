import { PartialType } from '@nestjs/mapped-types';
import { CreateResponsableDto } from './create-responsable.dto';

export class UpdateResponsableDto extends PartialType(CreateResponsableDto) {}
