import React from 'react'

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              HTHGSE Shewhart Chatbot
            </h1>
          </div>

          <nav className="hidden md:flex items-center space-x-6">
            <a href="#" className="text-gray-600 hover:text-primary-600 transition-colors duration-200">
              Home
            </a>
            <a href="#" className="text-gray-600 hover:text-primary-600 transition-colors duration-200">
              About
            </a>
            <a href="#" className="text-gray-600 hover:text-primary-600 transition-colors duration-200">
              Documentation
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              v0.1.0
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
