// src/evaluadores/evaluadores.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EvaluadoresService } from './evaluadores.service';

describe('EvaluadoresService', () => {
  let service: EvaluadoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluadoresService],
    }).compile();

    service = module.get<EvaluadoresService>(EvaluadoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
