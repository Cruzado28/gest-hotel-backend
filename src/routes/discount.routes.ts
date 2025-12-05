import { Router } from 'express';
import { DiscountController } from '../controllers/discount.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const discountController = new DiscountController();

router.get(
  '/applicable',
  authMiddleware,
  (req, res) => discountController.getApplicableDiscounts(req, res)
);

router.post(
  '/calculate',
  authMiddleware,
  (req, res) => discountController.calculateDiscount(req, res)
);

export default router;