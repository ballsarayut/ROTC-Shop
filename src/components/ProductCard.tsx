import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Package } from 'lucide-react';
import { Product } from '../types';
import { formatPrice, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      className="group bg-white rounded-2xl sm:rounded-[2rem] border-2 border-army-light/10 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-army-primary/10 transition-all duration-300 flex flex-col h-full hover:border-army-primary"
    >
      {/* Image Container */}
      <Link to={`/product/${product.id}`} className="relative aspect-square overflow-hidden bg-army-bg block">
        <img
          src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/400`}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-1 sm:gap-2">
          {isOutOfStock && (
            <span className="bg-red-500 text-white text-base sm:text-base font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-lg uppercase tracking-widest">
              หมด
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-3 sm:p-6 flex flex-col flex-grow">
        <span className="text-[10px] sm:text-xs font-black text-army-muted uppercase tracking-widest mb-1 sm:mb-2 inline-block px-2 py-0.5 sm:px-3 sm:py-1 bg-army-bg rounded-full">
          หมวดหมู่สินค้า: {product.category}
        </span>
        <Link to={`/product/${product.id}`} className="block mb-1 sm:mb-2">
          <h3 className="text-base sm:text-lg font-black text-army-dark group-hover:text-army-muted transition-colors uppercase tracking-tight">
            {product.name.includes('(จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)') ? (
              <>
                <span className="line-clamp-1">{product.name.replace('(จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)', '').trim()}</span>
                <span className="block mt-1 text-[10px] sm:text-xs text-orange-500 font-bold normal-case tracking-normal">
                  (จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)
                </span>
              </>
            ) : (
              <span className="line-clamp-1">{product.name}</span>
            )}
          </h3>
        </Link>
        
        <p className="hidden sm:block text-base text-army-muted font-medium line-clamp-2 mb-6 flex-grow leading-relaxed">
          {product.description}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto pt-3 sm:pt-6 border-t border-army-bg gap-2 sm:gap-0">
          <div className="flex flex-col">
            <span className="text-base sm:text-base font-black text-army-light uppercase tracking-widest leading-none mb-1">ราคา</span>
            <span className="text-lg sm:text-2xl font-mono font-black text-army-dark tracking-tighter">
              {formatPrice(product.price)}
            </span>
          </div>

          {isOutOfStock && (
            <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-base sm:text-base font-black uppercase tracking-widest flex items-center space-x-1 border w-fit bg-red-50 text-red-500 border-red-100">
              <Package size={10} className="sm:w-3 sm:h-3" />
              <span>หมด</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
