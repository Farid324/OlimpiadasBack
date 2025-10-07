import { Test, TestingModule } from '@nestjs/testing';
import { EvaluadoresController } from './evaluadores.controller';

describe('EvaluadoresController', () => {
  let controller: EvaluadoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluadoresController],
    }).compile();

    controller = module.get<EvaluadoresController>(EvaluadoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
